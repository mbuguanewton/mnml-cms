import { sql } from 'drizzle-orm';
import { customType, index, integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

const NAME = /^[a-z_][a-z0-9_]*$/i;

export type ChunksTableOptions = {
  /** Default 'mnml_chunks'. Match `search.table`. */
  name?: string;
  /** Text search configuration, default 'english'. Match `search.language`. */
  language?: string;
};

/**
 * The built-in search index: one row per passage of a published entry. Derived data, so it can always be rebuilt
 * with `cms.search.reindex()`.
 */
export function chunksTable({ name = 'mnml_chunks', language = 'english' }: ChunksTableOptions = {}) {
  if (!NAME.test(name)) throw new Error(`Invalid search table name "${name}".`);
  if (!NAME.test(language)) throw new Error(`Invalid search language "${language}".`);
  return pgTable(
    name,
    {
      id: serial('id').primaryKey(),
      collection: text('collection').notNull(),
      slug: text('slug').notNull(),
      /** 0, 1, 2… in reading order within the entry. */
      idx: integer('idx').notNull(),
      field: text('field').notNull(),
      title: text('title').notNull(),
      url: text('url'),
      text: text('text').notNull(),
      /** Of the title, url, field and text: an unchanged passage is not written again. */
      hash: text('hash').notNull(),
      // Title and text, so a title match finds every passage of the entry.
      tsv: tsvector('tsv').generatedAlwaysAs(sql.raw(`to_tsvector('${language}', coalesce("title", '') || ' ' || "text")`)),
    },
    (t) => [unique(`${name}_entry_idx`).on(t.collection, t.slug, t.idx), index(`${name}_tsv_idx`).using('gin', t.tsv)],
  );
}

/** The default table, for drizzle-kit and scripts. */
export const chunks = chunksTable();
