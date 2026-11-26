// A SearchIndex that searches by meaning as well as by words, as a reference for writing your own (the `search.index`
// option). It reuses the built-in Postgres index for the words and keeps the vectors in `mnml_vectors` (see
// pgvector-schema.ts), then merges the two result lists with `fuseMatches`. Embedding is yours: pass any `embed`.
//
//   search: { index: pgvectorSearch({ database: neonDatabase(process.env.DATABASE_URL), embed: openaiEmbed, model: 'text-embedding-3-small' }) }
//
// Run `cms.search.reindex()` once after switching it on, and again whenever you change `model`.
import { sql } from 'drizzle-orm';
import { fuseMatches, postgresSearch, type SearchIndex, type SearchMatch } from '@n3wtou/mnml-cms/sync';
import type { Database } from '@n3wtou/mnml-cms/db';

export type Embed = (texts: string[], kind: 'document' | 'query') => Promise<number[][]>;

/** OpenAI's embeddings API, called with `fetch` (key from OPENAI_API_KEY). */
export const openaiEmbed =
  (model = 'text-embedding-3-small'): Embed =>
  async (texts) => {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings failed (${res.status})`);
    const { data } = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  };

/**
 * Google's Gemini embeddings (`gemini-embedding-001`, key from GEMINI_KEY), cut to 1536 numbers to fit
 * pgvector-schema.ts. Tested against the real API.
 */
export const geminiEmbed =
  (model = 'gemini-embedding-001'): Embed =>
  async (texts, kind) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_KEY ?? '' },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${model}`,
          content: { parts: [{ text: t }] },
          taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 1536,
        })),
      }),
    });
    if (!res.ok) throw new Error(`Gemini embeddings failed (${res.status})`);
    const { embeddings } = (await res.json()) as { embeddings: { values: number[] }[] };
    // Shorter than 3072 numbers: normalise, as Google advises.
    return embeddings.map(({ values: v }) => {
      const n = Math.hypot(...v) || 1;
      return v.map((x) => x / n);
    });
  };

const rowsOf = <T>(res: unknown): T[] => (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];

export function pgvectorSearch({ database, embed, model }: { database: () => Database; embed: Embed; model: string }): SearchIndex {
  const words = postgresSearch({ database });
  const run = async <T>(q: ReturnType<typeof sql>) => rowsOf<T>(await database().execute(q));
  const slugOf = (slug: string | null) => slug ?? 'singleton';

  return {
    async put(entry) {
      await words.put(entry); // the words stay searchable even if embedding fails below
      const slug = slugOf(entry.slug);
      const have = new Map(
        (
          await run<{ idx: number; hash: string; model: string }>(
            sql`select idx, hash, model from mnml_vectors where collection = ${entry.key} and slug = ${slug}`,
          )
        ).map((r) => [r.idx, r]),
      );
      const stale = entry.chunks.filter((c) => have.get(c.idx)?.hash !== c.hash || have.get(c.idx)?.model !== model);
      if (stale.length) {
        const vectors = await embed(
          stale.map((c) => `${entry.title}\n\n${c.text}`),
          'document',
        );
        const values = stale.map((c, i) => sql`(${entry.key}, ${slug}, ${c.idx}, ${c.hash}, ${model}, ${JSON.stringify(vectors[i])}::vector)`);
        await run(sql`
          insert into mnml_vectors (collection, slug, idx, hash, model, embedding) values ${sql.join(values, sql`, `)}
          on conflict (collection, slug, idx) do update set hash = excluded.hash, model = excluded.model, embedding = excluded.embedding`);
      }
      await run(sql`delete from mnml_vectors where collection = ${entry.key} and slug = ${slug} and idx >= ${entry.chunks.length}`);
    },

    async remove(key, slug) {
      await words.remove(key, slug);
      await run(sql`delete from mnml_vectors where collection = ${key} and slug = ${slugOf(slug)}`);
    },

    async query(q, { collections, limit }) {
      const [vector] = await embed([q], 'query');
      const v = sql`${JSON.stringify(vector)}::vector`;
      const only = collections
        ? sql`and v.collection in (${sql.join(
            collections.map((c) => sql`${c}`),
            sql`, `,
          )})`
        : sql``;
      const near = await run<SearchMatch & { collection: string }>(sql`
        select v.collection as key, v.slug, c.title, c.url, c.field, c.text, 1 - (v.embedding <=> ${v}) as score
        from mnml_vectors v join mnml_chunks c on c.collection = v.collection and c.slug = v.slug and c.idx = v.idx
        where v.model = ${model} ${only}
        order by v.embedding <=> ${v}
        limit ${limit * 3}`);
      const byWords = await words.query(q, { collections, limit: limit * 3 });
      return fuseMatches([byWords, near.map((m) => ({ ...m, score: Number(m.score) }))]).slice(0, limit);
    },

    async prune(live) {
      await words.prune?.(live);
      const keep = new Set(live.map((e) => `${e.key}\u0000${slugOf(e.slug)}`));
      for (const e of await run<{ collection: string; slug: string }>(sql`select distinct collection, slug from mnml_vectors`))
        if (!keep.has(`${e.collection}\u0000${e.slug}`)) await run(sql`delete from mnml_vectors where collection = ${e.collection} and slug = ${e.slug}`);
    },
  };
}
