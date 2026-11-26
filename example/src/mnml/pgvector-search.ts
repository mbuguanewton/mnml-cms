// A search index that finds by meaning as well as by words, as an example of the `search.index` option. It wraps
// postgres-search.ts for the words and keeps the vectors in `mnml_vectors` (scripts/search-vectors.sql), then merges
// the two result lists with `fuseMatches`. Embedding is yours: pass any `embed` (openaiEmbed and geminiEmbed are below).
//
//   search: { index: pgvectorSearch({ url: process.env.DATABASE_URL, embed: geminiEmbed(), model: 'gemini-embedding-001' }) }
//
// Run `cms.search.reindex()` once after switching it on, and again whenever you change `model`.
import { neon } from '@neondatabase/serverless';
import { fuseMatches, type SearchIndex, type SearchMatch } from '@n3wtou/mnml-cms/sync';
import { postgresSearch } from './postgres-search';

export type Embed = (texts: string[], kind: 'document' | 'query') => Promise<number[][]>;

export function pgvectorSearch({ url, embed, model }: { url: string | undefined; embed: Embed; model: string }): SearchIndex {
  const words = postgresSearch(url);
  const db = () => neon(url ?? '');
  return {
    async put(entry) {
      await words.put(entry); // the words stay searchable even if embedding fails below
      const sql = db();
      const have = new Map((await sql`select idx, hash, model from mnml_vectors where entry = ${entry.id}`).map((r) => [r.idx as number, r]));
      const stale = entry.chunks.filter((c) => have.get(c.idx)?.hash !== c.hash || have.get(c.idx)?.model !== model);
      if (stale.length) {
        const vectors = await embed(
          stale.map((c) => `${entry.title}\n\n${c.text}`),
          'document',
        );
        await sql`
          insert into mnml_vectors (entry, idx, hash, model, embedding)
          select ${entry.id}, i, h, ${model}, v::vector
          from unnest(${stale.map((c) => c.idx)}::int[], ${stale.map((c) => c.hash)}::text[], ${vectors.map((v) => JSON.stringify(v))}::text[]) as c(i, h, v)
          on conflict (entry, idx) do update set hash = excluded.hash, model = excluded.model, embedding = excluded.embedding`;
      }
      await sql`delete from mnml_vectors where entry = ${entry.id} and idx >= ${entry.chunks.length}`;
    },

    async remove(id) {
      await words.remove(id);
      await db()`delete from mnml_vectors where entry = ${id}`;
    },

    async prune(live) {
      await words.prune!(live);
      await db()`delete from mnml_vectors where entry <> all(${live})`;
    },

    async query(q, { collections, limit }) {
      const [vector] = await embed([q], 'query');
      const near = await db()`
        select c.key, c.slug, c.title, c.url, c.field, c.text, 1 - (v.embedding <=> ${JSON.stringify(vector)}::vector) as score
        from mnml_vectors v join mnml_chunks c on c.entry = v.entry and c.idx = v.idx
        where v.model = ${model} and (${collections ?? null}::text[] is null or c.key = any(${collections ?? null}))
        order by v.embedding <=> ${JSON.stringify(vector)}::vector limit ${limit}`;
      const byWords = await words.query(q, { collections, limit });
      return fuseMatches([byWords, near.map((r) => ({ ...(r as SearchMatch), score: Number(r.score) }))]).slice(0, limit);
    },
  };
}

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
 * search-vectors.sql. Tested against the real API.
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
