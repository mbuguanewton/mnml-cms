-- The extra table for src/mnml/pgvector-search.ts: `pnpm db:search --vectors`.
-- 1536 numbers: text-embedding-3-small, or Gemini cut to 1536. Use your model's size.
create extension if not exists vector;
create table if not exists mnml_vectors (
  entry text not null,
  idx int not null,
  hash text not null,
  model text not null,
  embedding vector(1536) not null,
  primary key (entry, idx)
);
create index if not exists mnml_vectors_embedding_idx on mnml_vectors using hnsw (embedding vector_cosine_ops);
