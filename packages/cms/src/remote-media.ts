// Rehosting images from another site (e.g. cdn.sanity.io) through the CMS's media storage, for migration scripts.
// No `server-only`: it runs in plain scripts.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, type MediaStorage } from './server/media.js';

export type RemoteMediaOptions = {
  /** The CMS's `apiPath`, for the returned URL. Default '/api/mnml'. */
  apiPath?: string;
  /** Largest image to accept, in bytes. Default 4 MB, the same as uploads. */
  maxBytes?: number;
  /** Override for testing or proxies. Default: the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Refuse hosts that resolve to private, loopback or link-local addresses, checked again on every redirect. On for
   * imports an agent asks for (the MCP server), so a token can't make the site fetch its own network. Default false.
   */
  publicOnly?: boolean;
  /** Override for testing: resolves a host name to its addresses. Default: DNS. */
  resolve?: (host: string) => Promise<string[]>;
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

// Addresses an import from the open internet should never reach.
const PRIVATE = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  PRIVATE.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  PRIVATE.addSubnet(net, bits, 'ipv6');

/** Whether an IP address is private, loopback, link-local or otherwise not public. IPv4-mapped IPv6 is checked as IPv4. */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return PRIVATE.check(mapped, 'ipv4');
  const v = isIP(address);
  return v === 0 || PRIVATE.check(address, v === 4 ? 'ipv4' : 'ipv6');
}

const dnsResolve = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/** Reads a response body, giving up as soon as it passes `max` bytes (a missing or wrong content-length can't make it buffer more). */
async function readCapped(res: Response, max: number, source: string): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error(`${source} is larger than ${max} bytes.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

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
  const resolve = o.resolve ?? dnsResolve;

  /** Follows redirects by hand when `publicOnly`, checking each host before connecting to it. */
  async function download(source: string): Promise<Response> {
    if (!o.publicOnly) return doFetch(source, { redirect: 'follow' });
    let url = source;
    for (let hop = 0; hop <= 5; hop++) {
      if (!isHttps(url)) throw new Error(`${source} redirected to a non-https URL.`);
      const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
      if (addresses.length === 0) throw new Error(`Couldn't resolve ${host}.`);
      if (addresses.some(isPrivateAddress)) throw new Error(`${host} is not a public address.`);
      const res = await doFetch(url, { redirect: 'manual' });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!next) return res;
      url = new URL(next, url).href;
    }
    throw new Error(`${source} redirected too many times.`);
  }
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

    const res = await download(source);
    if (res.url && !isHttps(res.url)) throw new Error(`${source} redirected to a non-https URL.`);
    if (!res.ok) throw new Error(`Couldn't download ${source}: ${res.status} ${res.statusText}`.trim());
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_TYPES[type];
    if (!ext) throw new Error(`${source} is not a JPEG, PNG, WebP, GIF or AVIF image (${type || 'no content type'}).`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error(`${source} is larger than ${maxBytes} bytes.`);
    const bytes = await readCapped(res, maxBytes, source);

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
