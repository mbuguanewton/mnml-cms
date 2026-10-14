import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { del, get, list, put } from '@vercel/blob';

/**
 * Where uploaded images live. The store can be private: the CMS serves files itself at
 * <apiPath>/media/<key>, so pages never need direct access to the storage.
 * Implement this for any backend (S3, R2, a disk…).
 */
export type MediaFile = { key: string; size?: number; uploadedAt?: Date };

export type MediaStorage = {
  /** Store an uploaded file and return its key (unique, e.g. with a random suffix). */
  put(file: File, name: string): Promise<string>;
  /** Read a file by key, or null if it doesn't exist (or isn't a media key). */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType?: string; size?: number } | null>;
  /** Optional. Every stored file, for the admin's Media screen (shown only if this exists). */
  list?(): Promise<MediaFile[]>;
  /** Optional. Remove a file by key (enables Delete on the Media screen). */
  delete?(key: string): Promise<void>;
};

/**
 * Vercel Blob, private by default. Files go under `prefix`, and only keys under it are ever served,
 * so other files in the same store (e.g. private documents) can't be read through the media route.
 */
export function vercelBlobMedia({
  prefix = 'cms/',
  access = 'private',
  token,
}: { prefix?: string; access?: 'private' | 'public'; token?: string } = {}): MediaStorage {
  return {
    async put(file, name) {
      const blob = await put(`${prefix}${name}`, file, { access, addRandomSuffix: true, contentType: file.type, token });
      return blob.pathname;
    },
    async get(key) {
      if (!key.startsWith(prefix)) return null;
      const res = await get(key, { access, token }).catch(() => null);
      if (!res?.stream) return null;
      return { body: res.stream, contentType: res.blob.contentType ?? undefined, size: res.blob.size ?? undefined };
    },
    async list() {
      const files: MediaFile[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, token });
        files.push(...page.blobs.map((b) => ({ key: b.pathname, size: b.size, uploadedAt: b.uploadedAt })));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor && files.length < 5000);
      return files;
    },
    async delete(key) {
      if (key.startsWith(prefix)) await del(key, { token });
    },
  };
}

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };

/**
 * Files on the local disk, for development without a storage account. The default when `media` is
 * left out in `next dev`. Not for serverless hosting: its disk is read-only or thrown away.
 */
export function localMedia({ dir = '.mnml-uploads' }: { dir?: string } = {}): MediaStorage {
  const root = resolve(dir);
  return {
    async put(file, name) {
      const key = `${randomUUID().slice(0, 8)}-${name}`;
      await mkdir(root, { recursive: true });
      await writeFile(join(root, key), Buffer.from(await file.arrayBuffer()));
      return key;
    },
    async get(key) {
      const path = resolve(root, key);
      const contentType = TYPES[extname(key).toLowerCase()];
      if (!path.startsWith(root + sep) || !contentType) return null;
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) return null;
      return { body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>, contentType, size: info.size };
    },
    async list() {
      const names = await readdir(root).catch(() => []);
      const files = await Promise.all(
        names
          .filter((n) => TYPES[extname(n).toLowerCase()])
          .map(async (key): Promise<MediaFile | null> => {
            const info = await stat(join(root, key)).catch(() => null);
            return info?.isFile() ? { key, size: info.size, uploadedAt: info.mtime } : null;
          }),
      );
      return files.filter((f): f is MediaFile => f !== null);
    },
    async delete(key) {
      const path = resolve(root, key);
      if (path.startsWith(root + sep)) await unlink(path).catch(() => {});
    },
  };
}
