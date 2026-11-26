// The table for pgvector-search.ts. Not part of the default setup: to use it, enable pgvector
// (`create extension if not exists vector;`), add this file to `schema` in drizzle.config.ts and run `pnpm db:push`.
import { index, integer, pgTable, serial, text, unique, vector } from 'drizzle-orm/pg-core';

export const vectors = pgTable(
  'mnml_vectors',
  {
    id: serial('id').primaryKey(),
    collection: text('collection').notNull(),
    slug: text('slug').notNull(),
    idx: integer('idx').notNull(),
    /** The hash of the passage this vector was made from: unchanged passages are not embedded again. */
    hash: text('hash').notNull(),
    model: text('model').notNull(),
    // 1536 numbers: text-embedding-3-small. Use your model's size.
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  },
  (t) => [
    unique('mnml_vectors_entry_idx').on(t.collection, t.slug, t.idx),
    index('mnml_vectors_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);
