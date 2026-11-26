-- The table for src/mnml/postgres-search.ts. Run it with `pnpm db:search`.
create table if not exists mnml_chunks (
  entry text not null,
  idx int not null,
  key text not null,
  slug text,
  title text not null,
  url text,
  field text not null,
  text text not null,
  tsv tsvector generated always as (to_tsvector('english', title || ' ' || text)) stored,
  primary key (entry, idx)
);
create index if not exists mnml_chunks_tsv_idx on mnml_chunks using gin (tsv);
