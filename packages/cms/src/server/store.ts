import 'server-only';
import { cache } from 'react';
import { cookies, draftMode } from 'next/headers';
import type { EntryStatus } from '../api.js';
import { withDefaults, withDerived, type CmsConfig, type CollectionKey, type EntryFor, type SingletonKey } from '../define.js';
import type { EntryStorage } from './storage.js';

export const SINGLETON_SLUG = 'singleton';

// Preview drafts live in the same table under `draft:<key>`. They are only read while Draft Mode is
// on, which only signed-in editors can turn on, and only for the one entry named in PREVIEW_COOKIE,
// so abandoned drafts never leak into other previews.
export const PREVIEW_COOKIE = 'mnml_preview';
const draftKey = (key: string) => `draft:${key}`;
// Saved-but-unpublished edits to a published entry. Never read by the public readers.
const pendingKey = (key: string) => `pending:${key}`;

/**
 * `drafts: false` reads the saved version even in Draft Mode (the admin always does).
 * `all: true` also returns entries whose status is 'draft'; the public readers hide those
 * (except the one being previewed).
 */
export type ReadOptions = { drafts?: boolean; all?: boolean };

/** Sorting, filtering and paging for `listEntries`. Applied after drafts are merged in. */
export type ListOptions<E = Record<string, unknown>> = ReadOptions & {
  /** A field, or 'slug' | 'createdAt' | 'updatedAt'. Default: 'slug'. Empty values sort last. */
  orderBy?: 'slug' | 'createdAt' | 'updatedAt' | (keyof E & string);
  /** Default 'asc'. */
  order?: 'asc' | 'desc';
  filter?: (entry: E) => boolean;
  limit?: number;
  offset?: number;
};

type Item<E> = { slug: string; entry: E; status: EntryStatus; createdAt: Date | null; updatedAt: Date | null };

const isEmpty = (v: unknown) => v == null || v === '';

function compare(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b));
}

function arrange<E>(items: Item<E>[], o: ListOptions<E>) {
  const out = o.filter ? items.filter((i) => o.filter!(i.entry)) : [...items];
  // Stable sort: slug first so ties are deterministic, then the requested field.
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  const by = o.orderBy;
  if (by && by !== 'slug') {
    const sign = o.order === 'desc' ? -1 : 1;
    const value = (i: Item<E>): unknown => (by === 'createdAt' ? i.createdAt : by === 'updatedAt' ? i.updatedAt : (i.entry as Record<string, unknown>)[by]);
    out.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (isEmpty(x) || isEmpty(y)) return isEmpty(x) === isEmpty(y) ? 0 : isEmpty(x) ? 1 : -1;
      return sign * compare(x, y);
    });
  } else if (o.order === 'desc') out.reverse();
  const start = o.offset ?? 0;
  return out.slice(start, o.limit === undefined ? undefined : start + o.limit);
}

export function createStore<C extends CmsConfig>(config: C, storage: EntryStorage) {
  // Cached per request, so a page reading the same entry twice hits storage once.
  const readRow = cache((collection: string, slug: string) => storage.readRow(collection, slug));

  const readRows = cache(async (collection: string) => (await storage.readRows(collection)).sort((a, b) => a.slug.localeCompare(b.slug)));

  /** The `{ key, slug }` being previewed, or null. Cookies are only read in Draft Mode, so static renders stay static. */
  async function previewing(o?: ReadOptions) {
    if (o?.drafts === false || !(await draftMode()).isEnabled) return null;
    const [key, slug] = ((await cookies()).get(PREVIEW_COOKIE)?.value ?? '').split('/');
    return key && slug ? { key, slug } : null;
  }

  /** Stored data for one entry, or undefined if it is missing or hidden (a 'draft' that isn't being previewed). */
  async function readWithDraft(key: string, slug: string, o?: ReadOptions) {
    const p = await previewing(o);
    const isPreview = p?.key === key && p.slug === slug;
    const draft = isPreview ? await readRow(draftKey(key), slug) : undefined;
    if (draft) return draft.data;
    // Autosaved edits to the entry being previewed.
    const pending = isPreview ? await readRow(pendingKey(key), slug) : undefined;
    if (pending) return pending.data;
    const row = await readRow(key, slug);
    return row && (row.status === 'published' || o?.all || isPreview) ? row.data : undefined;
  }

  const write = (collection: string, slug: string, data: unknown, status: EntryStatus = 'published') => storage.upsert(collection, slug, data, status);
  const remove = (collection: string, slug: string) => storage.remove(collection, slug);

  return {
    async getSingleton<K extends SingletonKey<C>>(key: K, o?: ReadOptions): Promise<EntryFor<C, K> | null> {
      const data = await readWithDraft(key, SINGLETON_SLUG, o);
      return data === undefined ? null : (withDerived(config[key], withDefaults(config[key].fields, data)) as EntryFor<C, K>);
    },

    async listEntries<K extends CollectionKey<C>>(
      key: K,
      o: ListOptions<EntryFor<C, K>> = {},
    ): Promise<{ slug: string; entry: EntryFor<C, K>; status: EntryStatus }[]> {
      type E = EntryFor<C, K>;
      const items = new Map<string, Item<unknown>>();
      for (const r of await readRows(key)) {
        if (r.status === 'published' || o.all)
          items.set(r.slug, { slug: r.slug, entry: r.data, status: r.status as EntryStatus, createdAt: r.createdAt, updatedAt: r.updatedAt });
      }
      // In preview, the draft replaces its saved entry (even an unpublished one), or shows up if the entry is new.
      const p = await previewing(o);
      if (p?.key === key) {
        const draft = (await readRow(draftKey(key), p.slug)) ?? (await readRow(pendingKey(key), p.slug));
        if (draft !== undefined) {
          const saved = (await readRow(key, p.slug))?.status as EntryStatus | undefined;
          const prev = items.get(p.slug);
          items.set(p.slug, {
            slug: p.slug,
            entry: draft.data,
            status: saved ?? 'draft',
            createdAt: prev?.createdAt ?? null,
            updatedAt: prev?.updatedAt ?? null,
          });
        }
      }
      const withData = [...items.values()].map((i) => ({ ...i, entry: withDerived(config[key], withDefaults(config[key].fields, i.entry)) as E }));
      return arrange(withData, o).map(({ slug, entry, status }) => ({ slug, entry, status }));
    },

    async getEntry<K extends CollectionKey<C>>(key: K, slug: string, o?: ReadOptions): Promise<EntryFor<C, K> | null> {
      const data = await readWithDraft(key, slug, o);
      return data === undefined ? null : (withDerived(config[key], withDefaults(config[key].fields, data)) as EntryFor<C, K>);
    },

    /** Published slugs (all of them with `all: true`). Also fine in generateStaticParams, which runs outside a request. */
    async listSlugs(key: CollectionKey<C>, o?: Pick<ReadOptions, 'all'>) {
      return (await readRows(key)).filter((r) => r.status === 'published' || o?.all).map((r) => r.slug);
    },

    /** The stored row of an entry (live, or a never-published draft), or undefined. */
    getRow: (key: string, slug: string) => readRow(key, slug),

    /** The saved status of a collection entry, or null if it doesn't exist. */
    async getStatus(key: string, slug: string): Promise<EntryStatus | null> {
      return ((await readRow(key, slug))?.status as EntryStatus | undefined) ?? null;
    },

    /** Unpublished changes saved on top of a published entry, or undefined. */
    async getPending(key: string, slug: string) {
      return (await readRow(pendingKey(key), slug))?.data;
    },

    /** Slugs of the entries that have unpublished changes. */
    async listPending(key: string) {
      return new Set((await readRows(pendingKey(key))).map((r) => r.slug));
    },

    // Writes. Callers are responsible for auth and validation.
    upsert: write,
    /** Returns false if the slug is already taken. */
    insert: (collection: string, slug: string, data: unknown, status: EntryStatus = 'published') => storage.insertIfAbsent(collection, slug, data, status),
    remove,
    savePending: (key: string, slug: string, data: unknown) => write(pendingKey(key), slug, data),
    removePending: (key: string, slug: string) => remove(pendingKey(key), slug),
    saveDraft: (key: string, slug: string, data: unknown) => write(draftKey(key), slug, data),
    removeDraft: (key: string, slug: string) => remove(draftKey(key), slug),
  };
}

export type Store<C extends CmsConfig> = ReturnType<typeof createStore<C>>;
