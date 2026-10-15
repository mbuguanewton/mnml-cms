import { and, asc, eq } from 'drizzle-orm';
import { entriesTable, type Database } from './db.js';

/** A stored entry. `status` is 'draft' or 'published'. */
export type StoredRow = { data: unknown; status: string };

/**
 * Where entries live: one table of `(collection, slug)` rows holding JSON. Implement this to use
 * something other than Drizzle (Prisma, Kysely, plain SQL…); see the README. The CMS does its own
 * caching and sorting, so adapters only run plain queries.
 */
export type EntryStorage = {
  readRow(collection: string, slug: string): Promise<StoredRow | undefined>;
  /** Every row of a collection, in any order. */
  readRows(collection: string): Promise<(StoredRow & { slug: string; createdAt: Date; updatedAt: Date })[]>;
  /** Insert or replace, setting `updatedAt` to now. */
  upsert(collection: string, slug: string, data: unknown, status: string): Promise<void>;
  /** Insert unless the slug is taken. Returns whether it inserted. */
  insertIfAbsent(collection: string, slug: string, data: unknown, status: string): Promise<boolean>;
  remove(collection: string, slug: string): Promise<void>;
};

/** The built-in adapter, for any Drizzle Postgres database. */
export function drizzleStorage(getDb: () => Database, tableName?: string): EntryStorage {
  const entries = entriesTable(tableName);
  return {
    async readRow(collection, slug) {
      const [row] = await getDb()
        .select({ data: entries.data, status: entries.status })
        .from(entries)
        .where(and(eq(entries.collection, collection), eq(entries.slug, slug)))
        .limit(1);
      return row;
    },
    readRows: (collection) =>
      getDb()
        .select({ slug: entries.slug, data: entries.data, status: entries.status, createdAt: entries.createdAt, updatedAt: entries.updatedAt })
        .from(entries)
        .where(eq(entries.collection, collection))
        .orderBy(asc(entries.slug)),
    async upsert(collection, slug, data, status) {
      await getDb()
        .insert(entries)
        .values({ collection, slug, data, status })
        .onConflictDoUpdate({ target: [entries.collection, entries.slug], set: { data, status, updatedAt: new Date() } });
    },
    async insertIfAbsent(collection, slug, data, status) {
      const rows = await getDb().insert(entries).values({ collection, slug, data, status }).onConflictDoNothing().returning({ id: entries.id });
      return rows.length > 0;
    },
    async remove(collection, slug) {
      await getDb()
        .delete(entries)
        .where(and(eq(entries.collection, collection), eq(entries.slug, slug)));
    },
  };
}
