import { get, put } from '@vercel/blob';

/**
 * Where uploaded images live. The store can be private: the CMS serves files itself at
 * <apiPath>/media/<key>, so pages never need direct access to the storage.
 * Implement this for any backend (S3, R2, a disk…).
 */
export type MediaStorage = {
  /** Store an uploaded file and return its key (unique, e.g. with a random suffix). */
  put(file: File, name: string): Promise<string>;
  /** Read a file by key, or null if it doesn't exist (or isn't a media key). */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType?: string; size?: number } | null>;
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
  };
}
