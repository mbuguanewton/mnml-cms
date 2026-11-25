import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: vi.fn() }));
let draft = false;
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: draft }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../../schema/define.js');
const { createStore } = await import('./store.js');
const { cachedReaders, cacheTag, DEFAULT_CACHE_TTL } = await import('./cached-store.js');
type CacheWrap = import('./cached-store.js').CacheWrap;
type EntryStorage = import('./storage.js').EntryStorage;

const cmsConfig = config({
  home: singleton({ label: 'Home', fields: { headline: fields.text('Headline') } }),
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title') } }),
});

const created = new Date('2026-01-02T03:04:05.000Z');
const rows = [
  { collection: 'home', slug: 'singleton', data: { headline: 'Hi' }, status: 'published' },
  { collection: 'posts', slug: 'a', data: { title: 'Alpha' }, status: 'published' },
  { collection: 'posts', slug: 'b', data: { title: 'Beta' }, status: 'published' },
  { collection: 'posts', slug: 'd', data: { title: 'Draft' }, status: 'draft' },
];

let reads: number;
let seen: { keyParts: string[]; tags: string[]; revalidate: number }[];
/** A cache that keeps JSON in a Map, like the data cache (so dates come back as strings). */
const memory = new Map<string, string>();
const wrap: CacheWrap = async (fn, keyParts, o) => {
  seen.push({ keyParts, ...o });
  const id = JSON.stringify(keyParts);
  const hit = memory.get(id);
  if (hit !== undefined) return JSON.parse(hit);
  const value = await fn();
  memory.set(id, JSON.stringify(value));
  return value;
};

const storage: EntryStorage = {
  readRow: async (c, s) => (reads++, rows.find((r) => r.collection === c && r.slug === s)),
  readRows: async (c) => (reads++, rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: created, updatedAt: created }))),
  upsert: async () => {},
  insertIfAbsent: async () => true,
  remove: async () => {},
};

const readers = (option: Parameters<typeof cachedReaders>[1] = true) => cachedReaders(createStore(cmsConfig, storage), option, wrap);

beforeEach(() => {
  reads = 0;
  seen = [];
  draft = false;
  memory.clear();
});

describe('cachedReaders', () => {
  it('is the store itself when the option is off', async () => {
    const r = readers(false);
    await r.getEntry('posts', 'a');
    await r.getEntry('posts', 'a');
    expect(seen).toEqual([]);
    expect(reads).toBe(2);
  });

  it('reads storage once for repeated reads, per key and slug', async () => {
    const r = readers();
    expect((await r.getEntry('posts', 'a'))?.title).toBe('Alpha');
    expect((await r.getEntry('posts', 'a'))?.title).toBe('Alpha');
    expect(reads).toBe(1);
    await r.getEntry('posts', 'b');
    expect(reads).toBe(2);
    expect(await r.getEntry('posts', 'd')).toBeNull(); // a draft stays hidden, and a miss is cached too
    expect(await r.getEntry('posts', 'd')).toBeNull();
    expect(reads).toBe(3);
  });

  it('tags every read with its key and uses the ttl', async () => {
    await readers().getSingleton('home');
    await readers({ revalidate: 60 }).getEntry('posts', 'a');
    expect(seen.map((s) => [s.tags, s.revalidate])).toEqual([
      [[cacheTag('home')], DEFAULT_CACHE_TTL],
      [[cacheTag('posts')], 60],
    ]);
    expect(cacheTag('posts')).toBe('mnml:posts');
  });

  it('falls back to the default ttl for a bad value', async () => {
    await readers({ revalidate: -5 }).getEntry('posts', 'a');
    await readers({}).getEntry('posts', 'a');
    expect(seen.map((s) => s.revalidate)).toEqual([DEFAULT_CACHE_TTL, DEFAULT_CACHE_TTL]);
  });

  it('caches the published list, then filters, sorts and pages it per call', async () => {
    const r = readers();
    const all = await r.listEntries('posts');
    expect(all.map((i) => i.slug)).toEqual(['a', 'b']);
    const some = await r.listEntries('posts', { orderBy: 'title', order: 'desc', filter: (p) => p.title !== 'Alpha', limit: 1 });
    expect(some.map((i) => i.slug)).toEqual(['b']);
    expect(reads).toBe(1);
  });

  it('hands dates back as Dates from the cache', async () => {
    const r = readers();
    await r.listEntries('posts');
    const [first] = await r.listEntries('posts'); // from the cache: JSON turned the dates into strings
    expect(first.createdAt).toEqual(created);
    expect(first.updatedAt).toBeInstanceOf(Date);
    expect((await r.listEntries('posts', { orderBy: 'createdAt' }))[0].createdAt).toBeInstanceOf(Date);
  });

  it('caches getEntries and listSlugs', async () => {
    const r = readers();
    expect((await r.getEntries('posts', ['b', 'a', 'd'])).map((e) => e.slug)).toEqual(['b', 'a']);
    await r.getEntries('posts', ['b', 'a', 'd']);
    expect(await r.listSlugs('posts')).toEqual(['a', 'b']);
    await r.listSlugs('posts');
    expect(reads).toBe(2);
  });

  it("caches getEntries by the set of slugs, and keeps the caller's order", async () => {
    const r = readers();
    expect((await r.getEntries('posts', ['b', 'a'])).map((e) => e.slug)).toEqual(['b', 'a']);
    expect((await r.getEntries('posts', ['a', 'b', 'a', ''])).map((e) => e.slug)).toEqual(['a', 'b']);
    expect(seen.filter((s) => s.keyParts.includes('entries'))).toHaveLength(2);
    expect(reads).toBe(1);
  });

  it('skips the cache for `all: true`', async () => {
    const r = readers();
    expect((await r.listEntries('posts', { all: true })).map((i) => i.slug)).toEqual(['a', 'b', 'd']);
    expect(await r.listSlugs('posts', { all: true })).toEqual(['a', 'b', 'd']);
    expect(await r.getEntry('posts', 'd', { all: true })).toMatchObject({ title: 'Draft' });
    expect(seen).toEqual([]);
  });

  it('skips the cache in Draft Mode', async () => {
    const r = readers();
    draft = true;
    await r.getEntry('posts', 'a');
    await r.listEntries('posts');
    await r.getSingleton('home');
    await r.getEntries('posts', ['a']);
    expect(seen).toEqual([]);
  });

  it('still caches `drafts: false` reads in Draft Mode (they read the saved version)', async () => {
    const r = readers();
    draft = true;
    await r.getEntry('posts', 'a', { drafts: false });
    await r.getEntry('posts', 'a', { drafts: false });
    expect(reads).toBe(1);
  });
});
