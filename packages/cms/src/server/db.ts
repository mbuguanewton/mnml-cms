import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

// One generic table: every singleton and collection entry is a row, its fields live in `data`.
// Content-model changes only touch the config, never the database.
export const entriesTable = (name = 'entries') =>
  pgTable(
    name,
    {
      id: serial('id').primaryKey(),
      collection: text('collection').notNull(),
      slug: text('slug').notNull(),
      data: jsonb('data').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique(`${name}_collection_slug`).on(t.collection, t.slug)],
  );

/** The default table, for drizzle-kit (`schema` in drizzle.config.ts) and scripts. */
export const entries = entriesTable();

/** Any Drizzle Postgres database: neon-http, node-postgres, postgres.js… */
export type Database = PgDatabase<PgQueryResultHKT>;

/** Neon over HTTP, created on first use so a missing URL only fails when the CMS is actually used. */
export function neonDatabase(url: string | undefined): () => Database {
  let db: Database | undefined;
  return () => {
    if (!url) throw new Error('The CMS database URL is not set (e.g. DATABASE_URL).');
    return (db ??= drizzle(neon(url)) as unknown as Database);
  };
}
