// A search index on Postgres full-text search, as an example of the `search.index` option: copy it and change what you
// need. It stores one row per passage (table: scripts/search.sql) and searches words, with stemming and ranking.
// No extension, no API key. `put` is one statement, so it is atomic: a failed or overlapping save never leaves half an entry.
//
//   search: { index: postgresSearch(process.env.DATABASE_URL) }
import { neon } from '@neondatabase/serverless';
import type { SearchIndex, SearchMatch } from '@n3wtou/mnml-cms/sync';

export function postgresSearch(url: string | undefined): SearchIndex {
  // Created when first used, so a build without DATABASE_URL still works.
  const db = () => neon(url ?? '');
  return {
    async put({ id, key, slug, title, url, chunks }) {
      // Upsert the passages and delete the ones past the end, in one statement.
      await db()`
        with up as (
          insert into mnml_chunks (entry, idx, key, slug, title, url, field, text)
          select ${id}, i, ${key}, ${slug}, ${title}, ${url}, f, t
          from unnest(${chunks.map((c) => c.idx)}::int[], ${chunks.map((c) => c.field)}::text[], ${chunks.map((c) => c.text)}::text[]) as c(i, f, t)
          on conflict (entry, idx) do update set key = excluded.key, slug = excluded.slug, title = excluded.title, url = excluded.url, field = excluded.field, text = excluded.text
        )
        delete from mnml_chunks where entry = ${id} and idx >= ${chunks.length}`;
    },
    async remove(id) {
      await db()`delete from mnml_chunks where entry = ${id}`;
    },
    async prune(live) {
      await db()`delete from mnml_chunks where entry <> all(${live})`;
    },
    async query(q, { collections, limit }) {
      // Any word matches; passages with more of them rank higher.
      const words = (q.match(/[\p{L}\p{N}]+/gu) ?? []).join(' or ');
      const rows = await db()`
        select key, slug, title, url, field, text, ts_rank_cd(tsv, query) as score
        from mnml_chunks, websearch_to_tsquery('english', ${words}) as query
        where tsv @@ query and (${collections ?? null}::text[] is null or key = any(${collections ?? null}))
        order by score desc limit ${limit}`;
      return rows.map((r) => ({ ...(r as SearchMatch), score: Number(r.score) }));
    },
  };
}
