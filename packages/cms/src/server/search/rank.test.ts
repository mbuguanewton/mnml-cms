import { describe, expect, it } from 'vite-plus/test';
import { bestPerEntry, fuseMatches, queryTerms, snippet } from './rank.js';
import type { SearchMatch } from './types.js';

const m = (slug: string, text = slug, score = 0): SearchMatch => ({ key: 'posts', slug, title: slug, url: null, field: 'body', text, score });

describe('queryTerms', () => {
  it('lowercases, splits on punctuation and dedupes', () => {
    expect(queryTerms('How do Refunds work? refunds!')).toEqual(['how', 'do', 'refunds', 'work']);
    expect(queryTerms('  ?! ')).toEqual([]);
  });
});

describe('snippet', () => {
  it('returns short text whole', () => {
    expect(snippet('  a   b ', ['a'])).toBe('a b');
  });
  it('centres on the first query word', () => {
    const text = `${'lorem ipsum '.repeat(40)}needle ${'dolor sit '.repeat(40)}`;
    const s = snippet(text, ['needle'], 100);
    expect(s).toContain('needle');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThan(110);
  });
  it('starts at the top when nothing matches', () => {
    expect(snippet('word '.repeat(100), ['zzz'], 50).startsWith('word')).toBe(true);
  });
});

describe('fuseMatches', () => {
  it('ranks a passage found by both lists above one found by a single list', () => {
    const out = fuseMatches([
      [m('a'), m('b')],
      [m('b'), m('c')],
    ]);
    expect(out.map((x) => x.slug)).toEqual(['b', 'a', 'c']);
  });
  it('keeps different passages of one entry apart, and does not mutate the inputs', () => {
    const a = m('a', 'first', 5);
    const out = fuseMatches([[a], [{ ...a, text: 'second' }], [a]]);
    expect(out.map((x) => x.text)).toEqual(['first', 'second']);
    expect(a.score).toBe(5);
  });
});

describe('bestPerEntry', () => {
  it('keeps the best passage of each entry', () => {
    const out = bestPerEntry([m('a', 'low', 1), m('a', 'high', 3), m('b', 'only', 2)]);
    expect(out.map((x) => x.text)).toEqual(['high', 'only']);
  });
});
