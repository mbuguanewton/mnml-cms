import 'server-only';
import { draftMode } from 'next/headers';
import { unstable_cache } from 'next/cache';
import type { EntryStatus } from '../../api.js';
import type { CmsConfig } from '../../schema/define.js';
import { arrange, type ListOptions, type ReadOptions, type Store } from './store.js';

/** `cache` option of `createCms`: `true`, or `{ revalidate }` (seconds) to set how long a cached read may live. */
export type CacheOption = boolean | { revalidate?: number };

/** Seconds a cached read lives when nothing invalidates it: the safety net for writes made outside the CMS. */
export const DEFAULT_CACHE_TTL = 3600;

/** The cache tag of a collection or singleton. A save or delete expires it. */
export const cacheTag = (key: string) => `mnml:${key}`;

/** Runs `fn` through a cache. Next's data cache in the app; tests pass their own. */
export type CacheWrap = <T>(fn: () => Promise<T>, keyParts: string[], o: { tags: string[]; revalidate: number }) => Promise<T>;

const nextWrap: CacheWrap = (fn, keyParts, o) => unstable_cache(fn, keyParts, o)();

/** The cache's JSON round trip turns dates into strings. */
const reviveDate = (v: unknown) => (v == null ? null : new Date(v as string));

type Listed = { slug: string; entry: never; status: EntryStatus; createdAt: Date | null; updatedAt: Date | null }[];
const revive = (items: Listed): Listed => items.map((i) => ({ ...i, createdAt: reviveDate(i.createdAt), updatedAt: reviveDate(i.updatedAt) }));

/**
 * The public readers (`getSingleton`, `getEntry`, `getEntries`, `listEntries`, `listSlugs`), cached across requests when
 * `option` is on and tagged per key, so a save or delete can expire them. Left off, they are the store's own.
 *
 * Reads that must see unpublished data skip the cache: `all: true`, and everything in Draft Mode. The admin never
 * calls these (it uses the store directly), so editors always see what is stored.
 */
export function cachedReaders<C extends CmsConfig>(store: Store<C>, option: CacheOption | undefined, wrap: CacheWrap = nextWrap) {
  const plain = {
    getSingleton: store.getSingleton,
    listEntries: store.listEntries,
    getEntry: store.getEntry,
    getEntries: store.getEntries,
    listSlugs: store.listSlugs,
  };
  if (!option) return plain;

  const ttl = typeof option === 'object' && Number.isFinite(option.revalidate) && option.revalidate! > 0 ? option.revalidate! : DEFAULT_CACHE_TTL;
  // The callbacks read the saved version (`drafts: false`): no cookies or headers inside the cache.
  const saved = { drafts: false } as const;
  const run = <T>(key: string, parts: string[], fn: () => Promise<T>) => wrap(fn, ['mnml', ...parts], { tags: [cacheTag(key)], revalidate: ttl });
  // `drafts: false` reads the saved version even in Draft Mode, so it is safe to cache there.
  const skip = async (o?: ReadOptions) => !!o?.all || (o?.drafts !== false && (await draftMode()).isEnabled);

  return {
    getSingleton: (async (key, o) =>
      (await skip(o)) ? store.getSingleton(key, o) : run(key, ['singleton', key], () => store.getSingleton(key, saved))) as Store<C>['getSingleton'],

    getEntry: (async (key, slug, o) =>
      (await skip(o)) ? store.getEntry(key, slug, o) : run(key, ['entry', key, slug], () => store.getEntry(key, slug, saved))) as Store<C>['getEntry'],

    // Cached by the sorted slugs, so the same set in another order is one entry; the caller's order is put back here.
    getEntries: (async (key, slugs, o) => {
      if (await skip(o)) return store.getEntries(key, slugs, o);
      const wanted = [...new Set(slugs.filter((s) => typeof s === 'string' && s !== ''))];
      const sorted = [...wanted].sort();
      const found = await run(key, ['entries', key, JSON.stringify(sorted)], () => store.getEntries(key, sorted, saved));
      const bySlug = new Map(found.map((e) => [e.slug, e]));
      return wanted.flatMap((slug) => bySlug.get(slug) ?? []);
    }) as Store<C>['getEntries'],

    // The whole published list is cached, then filtered, sorted and paged here: a `filter` function can't be a cache key.
    listEntries: (async (key, o?: ListOptions<never>) => {
      if (await skip(o)) return store.listEntries(key, o as never);
      const items = revive(await run(key, ['list', key], () => store.listEntries(key, saved) as Promise<Listed>));
      return arrange(items, (o ?? {}) as ListOptions<unknown>);
    }) as Store<C>['listEntries'],

    // Slugs are public, and also read outside a request (generateStaticParams), where Draft Mode doesn't exist.
    listSlugs: (async (key, o) => (o?.all ? store.listSlugs(key, o) : run(key, ['slugs', key], () => store.listSlugs(key)))) as Store<C>['listSlugs'],
  };
}
