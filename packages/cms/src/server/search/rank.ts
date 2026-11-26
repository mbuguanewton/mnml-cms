import type { SearchMatch } from './types.js';

/** The distinct words of a query, lower case. */
export const queryTerms = (q: string) => [...new Set(q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];

/** A short passage of `text`, starting a little before the first query word. */
export function snippet(text: string, words: string[], width = 240): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= width) return flat;
  const lower = flat.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  let start = at < 0 ? 0 : Math.max(0, at - Math.floor(width / 3));
  // Start on a word, not in the middle of one.
  if (start > 0) {
    const space = flat.indexOf(' ', start);
    if (space >= 0 && space - start < 20) start = space + 1;
  }
  const end = start + width;
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

const entryId = (m: Pick<SearchMatch, 'key' | 'slug'>) => `${m.key}\u0000${m.slug ?? ''}`;

/**
 * Reciprocal rank fusion: merges ranked lists (say keyword and vector results) by position, so their scores never
 * need comparing. A passage found by several lists rises. Returns the passages best first, with the fused score.
 */
export function fuseMatches(lists: SearchMatch[][], k = 60): SearchMatch[] {
  const merged = new Map<string, SearchMatch>();
  for (const list of lists)
    list.forEach((m, rank) => {
      const id = `${entryId(m)}\u0000${m.field}\u0000${m.text}`;
      const seen = merged.get(id);
      const add = 1 / (k + rank + 1);
      if (seen) seen.score += add;
      else merged.set(id, { ...m, score: add });
    });
  return [...merged.values()].sort((a, b) => b.score - a.score);
}

/** The best passage of each entry, best entry first. */
export function bestPerEntry(matches: SearchMatch[]): SearchMatch[] {
  const best = new Map<string, SearchMatch>();
  for (const m of matches) {
    const seen = best.get(entryId(m));
    if (!seen || m.score > seen.score) best.set(entryId(m), m);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
