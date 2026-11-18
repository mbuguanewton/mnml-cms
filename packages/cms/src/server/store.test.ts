import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
// Outside a request: Draft Mode is off.
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields } = await import('../define.js');
const { createStore } = await import('./store.js');
type EntryStorage = import('./storage.js').EntryStorage;

const now = new Date();
const rows = [
  { collection: 'posts', slug: 'a', data: { title: 'Alpha' }, status: 'published' },
  { collection: 'posts', slug: 'b', data: { title: 'Beta' }, status: 'published' },
  { collection: 'posts', slug: 'c', data: { title: 'Gamma' }, status: 'published' },
  { collection: 'posts', slug: 'd', data: { title: 'Draft' }, status: 'draft' },
];

/** In-memory storage, optionally with `readRowsBySlug`, counting calls. */
function storage(withBatch: boolean) {
  const calls = { readRows: 0, readRowsBySlug: 0 };
  const s: EntryStorage = {
    readRow: async (c, slug) => rows.find((r) => r.collection === c && r.slug === slug),
    readRows: async (c) => (calls.readRows++, rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now }))),
    upsert: async () => {},
    insertIfAbsent: async () => true,
    remove: async () => {},
  };
  if (withBatch) s.readRowsBySlug = async (c, slugs) => (calls.readRowsBySlug++, rows.filter((r) => r.collection === c && slugs.includes(r.slug)).reverse());
  return { s, calls };
}

const cmsConfig = config({
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    fields: { title: fields.text('Title'), related: fields.references('Related', 'posts') },
  }),
});

describe('getEntries', () => {
  it('returns published entries in the order asked, with defaults filled in, in one storage call', async () => {
    const { s, calls } = storage(true);
    const out = await createStore(cmsConfig, s).getEntries('posts', ['c', 'a']);
    expect(out).toEqual([
      { slug: 'c', entry: { title: 'Gamma', related: [] } },
      { slug: 'a', entry: { title: 'Alpha', related: [] } },
    ]);
    expect(calls).toEqual({ readRows: 0, readRowsBySlug: 1 });
  });

  it('leaves out missing, draft, blank and repeated slugs', async () => {
    const { s } = storage(true);
    const out = await createStore(cmsConfig, s).getEntries('posts', ['b', 'missing', 'd', '', 'b']);
    expect(out.map((e) => e.slug)).toEqual(['b']);
  });

  it('includes drafts with all: true', async () => {
    const { s } = storage(true);
    expect((await createStore(cmsConfig, s).getEntries('posts', ['d'], { all: true })).map((e) => e.entry.title)).toEqual(['Draft']);
  });

  it('falls back to readRows when the storage has no readRowsBySlug', async () => {
    const { s, calls } = storage(false);
    const out = await createStore(cmsConfig, s).getEntries('posts', ['b', 'a']);
    expect(out.map((e) => e.slug)).toEqual(['b', 'a']);
    expect(calls.readRows).toBe(1);
  });

  it('does not touch storage for an empty list', async () => {
    const { s, calls } = storage(true);
    expect(await createStore(cmsConfig, s).getEntries('posts', [])).toEqual([]);
    expect(calls).toEqual({ readRows: 0, readRowsBySlug: 0 });
  });
});
