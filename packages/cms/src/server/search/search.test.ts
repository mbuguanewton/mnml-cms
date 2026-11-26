import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../../schema/define.js');
const { buildSearch } = await import('./search.js');
type SearchEntry = import('./types.js').SearchEntry;
type SearchIndex = import('./types.js').SearchIndex;
type SearchMatch = import('./types.js').SearchMatch;
type EntryStorage = import('../content/storage.js').EntryStorage;

type Row = { collection: string; slug: string; data: unknown; status: string };
const cms = config({
  settings: singleton({ label: 'Settings', preview: '/', fields: { tagline: fields.text('Tagline') } }),
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/blog', fields: { title: fields.text('Title'), body: fields.textarea('Body') } }),
});

let rows: Row[];
const storage: EntryStorage = {
  readRow: async (c, s) => rows.find((r) => r.collection === c && r.slug === s),
  readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() })),
  upsert: async () => {},
  insertIfAbsent: async () => true,
  remove: async () => {},
};

/** An index in memory: a passage matches when it has every word of the query. */
function memoryIndex(extra: Partial<SearchIndex> = {}) {
  const entries = new Map<string, SearchEntry>();
  const id = (key: string, slug: string | null) => `${key}/${slug ?? ''}`;
  const index: SearchIndex = {
    put: async (e) => void entries.set(id(e.key, e.slug), e),
    remove: async (k, s) => void entries.delete(id(k, s)),
    query: async (q, { collections, limit }) => {
      const words = q.toLowerCase().match(/\w+/g) ?? [];
      const out: SearchMatch[] = [];
      for (const e of entries.values())
        for (const c of e.chunks) {
          const hay = `${e.title} ${c.text}`.toLowerCase();
          if ((!collections || collections.includes(e.key)) && words.every((w) => hay.includes(w)))
            out.push({ key: e.key, slug: e.slug, title: e.title, url: e.url, field: c.field, text: c.text, score: words.length });
        }
      return out.slice(0, limit);
    },
    prune: async (live) => {
      const keep = new Set(live.map((e) => id(e.key, e.slug)));
      for (const k of entries.keys()) if (!keep.has(k)) entries.delete(k);
    },
    ...extra,
  };
  return { entries, index };
}

beforeEach(() => {
  rows = [
    { collection: 'settings', slug: 'singleton', data: { tagline: 'Small CMS' }, status: 'published' },
    { collection: 'posts', slug: 'refunds', data: { title: 'Refunds', body: 'You get your money back within a week.' }, status: 'published' },
    { collection: 'posts', slug: 'shipping', data: { title: 'Shipping', body: 'We ship worldwide in three days.' }, status: 'published' },
    { collection: 'posts', slug: 'wip', data: { title: 'Secret refunds plan', body: 'refund draft' }, status: 'draft' },
  ];
});

describe('reindex', () => {
  it('puts published entries only, and counts them', async () => {
    const { entries, index } = memoryIndex();
    expect(await buildSearch({ config: cms, storage, index }).reindex()).toEqual({ entries: 3, chunks: 3 });
    expect([...entries.keys()].sort((a, b) => a.localeCompare(b))).toEqual(['posts/refunds', 'posts/shipping', 'settings/']);
  });

  it('prunes entries that are no longer published', async () => {
    const { entries, index } = memoryIndex();
    const search = buildSearch({ config: cms, storage, index });
    await search.reindex();
    rows.find((r) => r.slug === 'shipping')!.status = 'draft';
    await search.reindex();
    expect(entries.has('posts/shipping')).toBe(false);
  });

  it('works with an index that has no prune', async () => {
    const { index } = memoryIndex({ prune: undefined });
    expect(await buildSearch({ config: cms, storage, index }).reindex()).toMatchObject({ entries: 3 });
  });
});

describe('query', () => {
  it('finds a passage and adds a snippet', async () => {
    const { index } = memoryIndex();
    const search = buildSearch({ config: cms, storage, index });
    await search.reindex();
    const hits = await search.query('money back');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ key: 'posts', slug: 'refunds', title: 'Refunds', url: '/blog/refunds', field: 'body' });
    expect(hits[0].snippet).toContain('money back');
  });

  it('reports a singleton with a null slug, even when the index stored one', async () => {
    const { index } = memoryIndex({
      query: async () => [{ key: 'settings', slug: 'singleton', title: 'Settings', url: '/', field: 'tagline', text: 'Small CMS', score: 1 }],
    });
    expect(await buildSearch({ config: cms, storage, index }).query('small')).toMatchObject([{ key: 'settings', slug: null }]);
  });

  it('keeps the best passage of each entry, honours limit and collections, and drops keys not in the config', async () => {
    const match = (slug: string, text: string, score: number, key = 'posts'): SearchMatch => ({
      key,
      slug,
      title: slug,
      url: null,
      field: 'body',
      text,
      score,
    });
    const calls: unknown[] = [];
    const { index } = memoryIndex({
      query: async (q, o) => {
        calls.push(o);
        return [match('a', 'weak', 1), match('a', 'strong', 3), match('b', 'other', 2), match('gone', 'old', 9, 'removed')];
      },
    });
    const search = buildSearch({ config: cms, storage, index });
    expect((await search.query('x')).map((h) => [h.slug, h.text])).toEqual([
      ['a', 'strong'],
      ['b', 'other'],
    ]);
    expect(await search.query('x', { limit: 1 })).toHaveLength(1);
    expect(calls[1]).toEqual({ collections: undefined, limit: 1 });
    expect(await search.query('x', { collections: ['nope'] })).toEqual([]);
    expect(await search.query('x', { limit: 9999 })).toBeDefined();
    expect(calls.at(-1)).toMatchObject({ limit: 50 });
    expect(await search.query('   ')).toEqual([]);
  });
});

describe('sync', () => {
  it('indexes a published entry, updates it, and removes it when unpublished or deleted', async () => {
    const { entries, index } = memoryIndex();
    const search = buildSearch({ config: cms, storage, index });
    await search.sync('posts', 'shipping');
    expect([...entries.keys()]).toEqual(['posts/shipping']);

    rows.find((r) => r.slug === 'shipping')!.data = { title: 'Shipping', body: 'Now we also ship to the moon.' };
    await search.sync('posts', 'shipping');
    expect(entries.get('posts/shipping')!.chunks[0].text).toContain('moon');

    rows.find((r) => r.slug === 'shipping')!.status = 'draft';
    await search.sync('posts', 'shipping');
    expect(entries.size).toBe(0);

    await search.sync('posts', 'refunds');
    rows.splice(
      rows.findIndex((r) => r.slug === 'refunds'),
      1,
    );
    await search.sync('posts', 'refunds');
    expect(entries.size).toBe(0);
  });

  it('sends a singleton with a null slug and removes it the same way', async () => {
    const { entries, index } = memoryIndex();
    const search = buildSearch({ config: cms, storage, index });
    await search.sync('settings', 'singleton');
    expect(entries.has('settings/')).toBe(true);
    rows[0].status = 'draft';
    await search.sync('settings', 'singleton');
    expect(entries.size).toBe(0);
  });

  it('never sends a draft, and ignores keys not in the config', async () => {
    const { entries, index } = memoryIndex();
    const search = buildSearch({ config: cms, storage, index });
    await search.sync('posts', 'wip');
    await search.sync('removed', 'x');
    expect(entries.size).toBe(0);
  });
});
