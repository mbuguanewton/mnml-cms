import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../content/db.js';
import { SINGLETON_SLUG } from '../content/singleton.js';
import { queryTerms } from './rank.js';
import type { SearchIndex, SearchMatch } from './types.js';

const NAME = /^[a-z_][a-z0-9_]*$/i;

// drizzle's `execute` answers `{ rows }` (node-postgres, neon) or the rows themselves (postgres.js).
const rowsOf = <T>(res: unknown): T[] => (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];

export type PostgresSearchOptions = {
  /** A Drizzle Postgres database, or a function returning one. */
  database: Database | (() => Database);
  /** Default 'mnml_chunks'. Create it with `chunksTable({ name })`. */
  table?: string;
  /** Default 'english'. Must match `chunksTable({ language })`. */
  language?: string;
};

/**
 * The built-in search index: Postgres full-text search (stemming and ranking, no extension, no API key) over the
 * `mnml_chunks` table. `search: true` uses it. It is also a starting point for your own `SearchIndex`.
 */
export function postgresSearch({ database, table = 'mnml_chunks', language = 'english' }: PostgresSearchOptions): SearchIndex {
  if (!NAME.test(table)) throw new Error(`Invalid search table name "${table}".`);
  if (!NAME.test(language)) throw new Error(`Invalid search language "${language}".`);
  const t = sql.identifier(table);
  const lang = sql.raw(`'${language}'`);
  const run = async <R>(q: SQL) => rowsOf<R>(await (typeof database === 'function' ? database() : database).execute(q));
  const only = (collections?: string[]) =>
    collections
      ? sql`and collection in (${sql.join(
          collections.map((c) => sql`${c}`),
          sql`, `,
        )})`
      : sql``;
  const slugOf = (slug: string | null) => slug ?? SINGLETON_SLUG;

  // The best passage of each entry, best entry first.
  const search = (q: SQL, collections: string[] | undefined, limit: number) =>
    run<{ key: string; slug: string; title: string; url: string | null; field: string; text: string; score: number | string }>(sql`
      select key, slug, title, url, field, text, score from (
        select distinct on (collection, slug) collection as key, slug, title, url, field, text, collection, ts_rank_cd(tsv, q) as score
        from ${t}, ${q} as q
        where tsv @@ q ${only(collections)}
        order by collection, slug, score desc, idx
      ) best
      order by score desc, key, slug
      limit ${limit}`);

  return {
    async put(entry) {
      const slug = slugOf(entry.slug);
      const have = new Map(
        (await run<{ idx: number; hash: string }>(sql`select idx, hash from ${t} where collection = ${entry.key} and slug = ${slug}`)).map((r) => [
          r.idx,
          r.hash,
        ]),
      );
      const changed = entry.chunks.filter((c) => have.get(c.idx) !== c.hash);
      if (changed.length) {
        const values = changed.map((c) => sql`(${entry.key}, ${slug}, ${c.idx}, ${c.field}, ${entry.title}, ${entry.url}, ${c.text}, ${c.hash})`);
        await run(sql`
          insert into ${t} (collection, slug, idx, field, title, url, text, hash)
          values ${sql.join(values, sql`, `)}
          on conflict (collection, slug, idx) do update set
            field = excluded.field, title = excluded.title, url = excluded.url, text = excluded.text, hash = excluded.hash`);
      }
      await run(sql`delete from ${t} where collection = ${entry.key} and slug = ${slug} and idx >= ${entry.chunks.length}`);
    },

    async remove(key, slug) {
      await run(sql`delete from ${t} where collection = ${key} and slug = ${slugOf(slug)}`);
    },

    async query(q, { collections, limit }) {
      let rows = await search(sql`websearch_to_tsquery(${lang}, ${q})`, collections, limit);
      // A question rarely has every word in one passage: fall back to any of them.
      const words = queryTerms(q);
      if (!rows.length && words.length) rows = await search(sql`to_tsquery(${lang}, ${words.join(' | ')})`, collections, limit);
      return rows.map((r): SearchMatch => ({ ...r, slug: r.slug, score: Number(r.score) }));
    },

    async prune(live) {
      const keep = new Set(live.map((e) => `${e.key}\u0000${slugOf(e.slug)}`));
      for (const e of await run<{ collection: string; slug: string }>(sql`select distinct collection, slug from ${t}`))
        if (!keep.has(`${e.collection}\u0000${e.slug}`)) await run(sql`delete from ${t} where collection = ${e.collection} and slug = ${e.slug}`);
    },
  };
}
