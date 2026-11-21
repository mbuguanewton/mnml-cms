import { describe, expect, it, vi } from 'vite-plus/test';
import { importRemoteMedia, mediaImporter } from './remote-media.js';
import type { MediaStorage } from './server/media.js';

/** In-memory storage that names keys like the built-in ones (a random part plus the given name). */
function memoryMedia({ withList = true } = {}) {
  const files = new Map<string, File>();
  let n = 0;
  const put = vi.fn(async (file: File, name: string) => {
    const key = `cms/${name.replace(/\.(\w+)$/, `-r${++n}.$1`)}`;
    files.set(key, file);
    return key;
  });
  const storage: MediaStorage = { put, get: async () => null };
  if (withList) storage.list = async () => [...files.keys()].map((key) => ({ key }));
  return { storage, files, put };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
/** A fake fetch answering every URL with the given response (and optional final URL after redirects). */
const fakeFetch = (o: { type?: string; body?: Uint8Array<ArrayBuffer>; status?: number; finalUrl?: string; length?: string } = {}) =>
  vi.fn(async (input: string | URL | Request) => {
    const headers = new Headers();
    if (o.type !== '') headers.set('content-type', o.type ?? 'image/png');
    if (o.length) headers.set('content-length', o.length);
    const res = new Response(new Blob([o.body ?? PNG]), { status: o.status ?? 200, headers });
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    Object.defineProperty(res, 'url', { value: o.finalUrl ?? url });
    return res;
  }) as unknown as typeof fetch;

const SRC = 'https://cdn.sanity.io/images/abc/production/photo.png';

describe('importRemoteMedia', () => {
  it('downloads the image, stores it and returns its URL on this site', async () => {
    const { storage, files } = memoryMedia();
    const r = await importRemoteMedia(SRC, storage, { fetch: fakeFetch() });
    expect(r.reused).toBe(false);
    expect(r.url).toBe(`/api/mnml/media/${r.key}`);
    expect(r.key).toMatch(/^cms\/remote-[0-9a-f]{16}-r1\.png$/);
    expect(new Uint8Array(await files.get(r.key)!.arrayBuffer())).toEqual(PNG);
    // The media route only serves keys like this.
    expect(/^[\w.\-/]+$/.test(r.key) && !r.key.includes('..')).toBe(true);
  });

  it('uses the given apiPath', async () => {
    const { storage } = memoryMedia();
    expect((await importRemoteMedia(SRC, storage, { fetch: fakeFetch(), apiPath: '/api/cms' })).url).toMatch(/^\/api\/cms\/media\//);
  });

  it('reuses an earlier import found in storage, without downloading again', async () => {
    const { storage, put } = memoryMedia();
    const first = await importRemoteMedia(SRC, storage, { fetch: fakeFetch() });
    const fetchAgain = fakeFetch();
    const second = await importRemoteMedia(SRC, storage, { fetch: fetchAgain });
    expect(second).toEqual({ url: first.url, key: first.key, reused: true });
    expect(fetchAgain).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('imports different sources separately', async () => {
    const { storage } = memoryMedia();
    const imp = mediaImporter(storage, { fetch: fakeFetch() });
    const a = await imp(SRC);
    const b = await imp(`${SRC}?w=200`);
    expect(a.key).not.toBe(b.key);
  });

  it('without list(), still stores each source once per importer', async () => {
    const { storage, put } = memoryMedia({ withList: false });
    const imp = mediaImporter(storage, { fetch: fakeFetch() });
    const first = await imp(SRC);
    expect(await imp(SRC)).toEqual({ ...first, reused: true });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('lists storage once per importer', async () => {
    const { storage } = memoryMedia();
    const list = vi.spyOn(storage, 'list' as never);
    const imp = mediaImporter(storage, { fetch: fakeFetch() });
    await imp(SRC);
    await imp(`${SRC}?2`);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe('importRemoteMedia refuses', () => {
  const run = (src: string, f: typeof fetch, o = {}) => importRemoteMedia(src, memoryMedia().storage, { fetch: f, ...o });

  it('non-https sources and redirects away from https', async () => {
    await expect(run('http://example.com/a.png', fakeFetch())).rejects.toThrow(/Only https/);
    await expect(run('not a url', fakeFetch())).rejects.toThrow(/Only https/);
    await expect(run(SRC, fakeFetch({ finalUrl: 'http://example.com/a.png' }))).rejects.toThrow(/non-https/);
  });

  it('failed downloads', async () => {
    await expect(run(SRC, fakeFetch({ status: 404 }))).rejects.toThrow(/Couldn't download .* 404/);
  });

  it('anything that is not a supported image', async () => {
    await expect(run(SRC, fakeFetch({ type: 'text/html; charset=utf-8' }))).rejects.toThrow(/not a JPEG, PNG, WebP, GIF or AVIF image \(text\/html\)/);
    await expect(run(SRC, fakeFetch({ type: 'image/svg+xml' }))).rejects.toThrow(/not a JPEG/);
    await expect(run(SRC, fakeFetch({ type: '' }))).rejects.toThrow(/no content type/);
  });

  it('images over the size limit, by header or by actual size', async () => {
    await expect(run(SRC, fakeFetch({ length: '999999999' }))).rejects.toThrow(/larger than/);
    await expect(run(SRC, fakeFetch({ body: new Uint8Array(10) }), { maxBytes: 5 })).rejects.toThrow(/larger than 5 bytes/);
  });

  it('publicOnly refuses private hosts, also after a redirect', async () => {
    const { storage } = memoryMedia();
    const resolve = async (host: string) => (host === 'cdn.example.com' ? ['93.184.216.34'] : ['10.0.0.5']);
    const ok = mediaImporter(storage, { fetch: fakeFetch(), publicOnly: true, resolve });
    await expect(ok('https://cdn.example.com/a.png')).resolves.toMatchObject({ reused: false });
    await expect(ok('https://internal.example.com/a.png')).rejects.toThrow('not a public address');
    await expect(ok('https://127.0.0.1/a.png')).rejects.toThrow('not a public address');
    await expect(ok('https://[::ffff:192.168.1.1]/a.png')).rejects.toThrow('not a public address');

    const redirecting = vi.fn(async (input: string) =>
      input.includes('cdn.example.com')
        ? new Response(null, { status: 302, headers: { location: 'https://internal.example.com/x.png' } })
        : new Response(new Blob([PNG]), { headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const viaRedirect = mediaImporter(memoryMedia().storage, { fetch: redirecting, publicOnly: true, resolve });
    await expect(viaRedirect('https://cdn.example.com/r.png')).rejects.toThrow('not a public address');
    expect(redirecting).toHaveBeenCalledTimes(1);
  });

  it('stops reading a body without content-length at the size limit', async () => {
    const big = new Uint8Array(64);
    const r = mediaImporter(memoryMedia().storage, { fetch: fakeFetch({ body: big }), maxBytes: 16 });
    await expect(r('https://cdn.example.com/big.png')).rejects.toThrow('larger than 16 bytes');
  });
});
