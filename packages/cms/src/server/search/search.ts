import type { CmsConfig } from '../../schema/define.js';
import type { EntryStorage } from '../content/storage.js';
import { SINGLETON_SLUG } from '../content/singleton.js';
import { searchEntry } from './entry.js';
import { bestPerEntry, queryTerms, snippet } from './rank.js';
import type { SearchHit, SearchIndex, SearchQuery } from './types.js';

const MAX_LIMIT = 50;
/** An index may return several passages of one entry, and only the best of each is kept: ask for a wider window. */
const WINDOW = 3;

export type Search = ReturnType<typeof buildSearch>;

/**
 * Search over published entries, on top of any `SearchIndex`. `sync` brings one entry in step with storage (after a
 * publish, unpublish or delete), `reindex` rebuilds everything, `query` reads. Drafts are never indexed: only a row
 * whose status is 'published' is, and pending changes live in their own rows.
 */
export function buildSearch({ config, storage, index }: { config: CmsConfig; storage: EntryStorage; index: SearchIndex }) {
  const slugOf = (key: string, slug: string) => (config[key].kind === 'singleton' ? null : slug);

  async function sync(key: string, slug: string): Promise<void> {
    if (!Object.hasOwn(config, key)) return;
    const row = await storage.readRow(key, slug);
    const entry = row?.status === 'published' ? searchEntry(config, key, slug, row.data) : null;
    if (entry) await index.put(entry);
    else await index.remove(key, slugOf(key, slug));
  }

  async function reindex(): Promise<{ entries: number; chunks: number; failed: { key: string; slug: string | null; message: string }[] }> {
    const live: { key: string; slug: string | null }[] = [];
    const failed: { key: string; slug: string | null; message: string }[] = [];
    let chunks = 0;
    for (const [key, def] of Object.entries(config)) {
      const rows =
        def.kind === 'singleton'
          ? [{ slug: SINGLETON_SLUG, row: await storage.readRow(key, SINGLETON_SLUG) }]
          : (await storage.readRows(key)).map((row) => ({ slug: row.slug, row }));
      for (const { slug, row } of rows) {
        if (row?.status !== 'published') continue;
        const entry = searchEntry(config, key, slug, row.data)!;
        // An entry that fails (say, the embedding API rejects it) must not stop the rest, nor be pruned with its old passages.
        live.push({ key, slug: entry.slug });
        try {
          await index.put(entry);
          chunks += entry.chunks.length;
        } catch (e) {
          failed.push({ key, slug: entry.slug, message: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    await index.prune?.(live);
    return { entries: live.length - failed.length, chunks, failed };
  }

  async function query(q: string, o: SearchQuery = {}): Promise<SearchHit[]> {
    const words = queryTerms(q);
    if (!words.length) return [];
    const limit = Math.min(Math.max(Math.trunc(o.limit ?? 10) || 10, 1), MAX_LIMIT);
    const collections = o.collections?.filter((k) => Object.hasOwn(config, k));
    if (collections && collections.length === 0) return [];
    const matches = (await index.query(q, { collections, limit: limit * WINDOW }))
      // Passages of collections that are no longer in the config can linger in an index; never return them.
      .filter((m) => Object.hasOwn(config, m.key) && (!collections || collections.includes(m.key)))
      .map((m) => ({ ...m, slug: slugOf(m.key, m.slug ?? SINGLETON_SLUG) }));
    return bestPerEntry(matches)
      .slice(0, limit)
      .map((m) => ({ ...m, snippet: snippet(m.text, words), score: Math.round(m.score * 10000) / 10000 }));
  }

  return { sync, reindex, query };
}
