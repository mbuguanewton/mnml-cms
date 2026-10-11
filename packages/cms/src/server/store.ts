import 'server-only';
import { cache } from 'react';
import { cookies, draftMode } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { withDefaults, type CmsConfig, type CollectionKey, type EntryFor, type SingletonKey } from '../define.js';
import { entriesTable, type Database } from './db.js';

export const SINGLETON_SLUG = 'singleton';

// Preview drafts live in the same table under `draft:<key>`. They are only read while Draft Mode is
// on, which only signed-in editors can turn on, and only for the one entry named in PREVIEW_COOKIE,
// so abandoned drafts never leak into other previews.
export const PREVIEW_COOKIE = 'cms_preview';
const draftKey = (key: string) => `draft:${key}`;

/** `drafts: false` reads the saved version even in Draft Mode (the admin always does). */
export type ReadOptions = { drafts?: boolean };

export function createStore<C extends CmsConfig>(config: C, getDb: () => Database, tableName?: string) {
  const entries = entriesTable(tableName);

  const readRow = cache(async (collection: string, slug: string) => {
    const [row] = await getDb()
      .select({ data: entries.data })
      .from(entries)
      .where(and(eq(entries.collection, collection), eq(entries.slug, slug)))
      .limit(1);
    return row?.data;
  });

  const readRows = cache(async (collection: string) =>
    getDb().select({ slug: entries.slug, data: entries.data }).from(entries).where(eq(entries.collection, collection)).orderBy(asc(entries.slug)),
  );

  /** The `{ key, slug }` being previewed, or null. Cookies are only read in Draft Mode, so static renders stay static. */
  async function previewing(o?: ReadOptions) {
    if (o?.drafts === false || !(await draftMode()).isEnabled) return null;
    const [key, slug] = ((await cookies()).get(PREVIEW_COOKIE)?.value ?? '').split('/');
    return key && slug ? { key, slug } : null;
  }

  async function readWithDraft(key: string, slug: string, o?: ReadOptions) {
    const p = await previewing(o);
    const draft = p?.key === key && p.slug === slug ? await readRow(draftKey(key), slug) : undefined;
    return draft ?? (await readRow(key, slug));
  }

  async function write(collection: string, slug: string, data: unknown) {
    await getDb()
      .insert(entries)
      .values({ collection, slug, data })
      .onConflictDoUpdate({ target: [entries.collection, entries.slug], set: { data, updatedAt: new Date() } });
  }

  async function remove(collection: string, slug: string) {
    await getDb().delete(entries).where(and(eq(entries.collection, collection), eq(entries.slug, slug)));
  }

  return {
    async getSingleton<K extends SingletonKey<C>>(key: K, o?: ReadOptions): Promise<EntryFor<C, K> | null> {
      const data = await readWithDraft(key, SINGLETON_SLUG, o);
      return data === undefined ? null : (withDefaults(config[key].fields, data) as EntryFor<C, K>);
    },

    async listEntries<K extends CollectionKey<C>>(key: K, o?: ReadOptions): Promise<{ slug: string; entry: EntryFor<C, K> }[]> {
      const bySlug = new Map((await readRows(key)).map((r) => [r.slug, r.data]));
      // In preview, the draft replaces its saved entry, or shows up if the entry is new.
      const p = await previewing(o);
      if (p?.key === key) {
        const draft = await readRow(draftKey(key), p.slug);
        if (draft !== undefined) bySlug.set(p.slug, draft);
      }
      return [...bySlug].map(([slug, data]) => ({ slug, entry: withDefaults(config[key].fields, data) as EntryFor<C, K> }));
    },

    async getEntry<K extends CollectionKey<C>>(key: K, slug: string, o?: ReadOptions): Promise<EntryFor<C, K> | null> {
      const data = await readWithDraft(key, slug, o);
      return data === undefined ? null : (withDefaults(config[key].fields, data) as EntryFor<C, K>);
    },

    /** Saved slugs only. Also fine in generateStaticParams, which runs outside a request. */
    async listSlugs(key: CollectionKey<C>) {
      return (await readRows(key)).map((r) => r.slug);
    },

    // Writes. Callers are responsible for auth and validation.
    upsert: write,
    /** Returns false if the slug is already taken. */
    async insert(collection: string, slug: string, data: unknown) {
      const rows = await getDb().insert(entries).values({ collection, slug, data }).onConflictDoNothing().returning({ id: entries.id });
      return rows.length > 0;
    },
    remove,
    saveDraft: (key: string, slug: string, data: unknown) => write(draftKey(key), slug, data),
    removeDraft: (key: string, slug: string) => remove(draftKey(key), slug),
  };
}

export type Store<C extends CmsConfig> = ReturnType<typeof createStore<C>>;
