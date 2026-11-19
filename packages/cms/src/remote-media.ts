// Rehosting images from another site (e.g. cdn.sanity.io) through the CMS's media storage, for migration scripts.
// No `server-only`: it runs in plain scripts.
import { createHash } from 'node:crypto';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, type MediaStorage } from './server/media.js';

export type RemoteMediaOptions = {
  /** The CMS's `apiPath`, for the returned URL. Default '/api/mnml'. */
  apiPath?: string;
  /** Largest image to accept, in bytes. Default 4 MB, the same as uploads. */
  maxBytes?: number;
  /** Override for testing or proxies. Default: the global `fetch`. */
  fetch?: typeof fetch;
};

export type RemoteMediaResult = {
  /** The image's URL on this site (`/api/mnml/media/<key>`), to store in an `image` field. */
  url: string;
  key: string;
  /** True if the image had already been imported, so nothing was downloaded or stored. */
  reused: boolean;
};

/** A stored copy of `source` is named after this, so a later import can find it. */
const sourceId = (source: string) => `remote-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
const ID_IN_KEY = /remote-([0-9a-f]{16})/;

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Returns `importRemoteMedia(sourceUrl)` for one storage. Imports are idempotent: each image is stored once, named
 * after its source URL, and found again through `storage.list()` (both built-in storages have it). A storage
 * without `list()` still gets each source once per importer. Use one importer for a whole migration run.
 */
export function mediaImporter(storage: MediaStorage, o: RemoteMediaOptions = {}) {
  const apiPath = o.apiPath ?? '/api/mnml';
  const maxBytes = o.maxBytes ?? MAX_IMAGE_BYTES;
  const doFetch = o.fetch ?? fetch;
  let index: Promise<Map<string, string>> | undefined;

  // Earlier imports in storage, by source id: listed once.
  const known = () =>
    (index ??= (async () => {
      const map = new Map<string, string>();
      for (const file of (await storage.list?.()) ?? []) {
        const id = ID_IN_KEY.exec(file.key)?.[1];
        if (id) map.set(`remote-${id}`, file.key);
      }
      return map;
    })());

  return async function importRemoteMedia(sourceUrl: string): Promise<RemoteMediaResult> {
    const source = sourceUrl.trim();
    if (!isHttps(source)) throw new Error(`Only https:// images can be imported: ${source}`);
    const id = sourceId(source);
    const map = await known();
    const existing = map.get(id);
    if (existing) return { url: `${apiPath}/media/${existing}`, key: existing, reused: true };

    const res = await doFetch(source, { redirect: 'follow' });
    if (res.url && !isHttps(res.url)) throw new Error(`${source} redirected to a non-https URL.`);
    if (!res.ok) throw new Error(`Couldn't download ${source}: ${res.status} ${res.statusText}`.trim());
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_TYPES[type];
    if (!ext) throw new Error(`${source} is not a JPEG, PNG, WebP, GIF or AVIF image (${type || 'no content type'}).`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error(`${source} is larger than ${maxBytes} bytes.`);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > maxBytes) throw new Error(`${source} is larger than ${maxBytes} bytes.`);

    const name = `${id}.${ext}`;
    const key = await storage.put(new File([bytes], name, { type }), name);
    map.set(id, key);
    return { url: `${apiPath}/media/${key}`, key, reused: false };
  };
}

/** Downloads one image from `sourceUrl` and stores it; see `mediaImporter` for many. */
export function importRemoteMedia(sourceUrl: string, storage: MediaStorage, o?: RemoteMediaOptions): Promise<RemoteMediaResult> {
  return mediaImporter(storage, o)(sourceUrl);
}
