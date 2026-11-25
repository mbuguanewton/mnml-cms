import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
// Outside a request: Draft Mode is off.
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields } = await import('../../schema/define.js');
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

describe('readers for a site (fit: true)', () => {
  // The config changed since these were saved: `title` held a rich text document, `related` held a string.
  const stale = [
    { collection: 'posts', slug: 'old', data: { title: { type: 'doc', content: [] }, related: 'a' }, status: 'published' },
    { collection: 'posts', slug: 'fine', data: { title: 'Fine', related: ['a'] }, status: 'published' },
  ];
  const staleStorage = (): EntryStorage => ({
    readRow: async (c, s) => stale.find((r) => r.collection === c && r.slug === s),
    readRows: async (c) => stale.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now })),
    upsert: async () => {},
    insertIfAbsent: async () => true,
    remove: async () => {},
  });

  it('read a value that does not fit as the empty value, in every reader', async () => {
    const store = createStore(cmsConfig, staleStorage(), { fit: true });
    expect(await store.getEntry('posts', 'old')).toMatchObject({ title: '', related: [] });
    expect((await store.listEntries('posts')).map((i) => [i.slug, i.entry.title])).toEqual([
      ['fine', 'Fine'],
      ['old', ''],
    ]);
    expect((await store.getEntries('posts', ['old', 'fine'])).map((e) => e.entry.title)).toEqual(['', 'Fine']);
  });

  it('leave a valid entry as it is', async () => {
    expect(await createStore(cmsConfig, staleStorage(), { fit: true }).getEntry('posts', 'fine')).toMatchObject({ title: 'Fine', related: ['a'] });
  });

  it('warn once for each entry and field in development, and not otherwise', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createStore(cmsConfig, staleStorage(), { fit: true });
    vi.stubEnv('NODE_ENV', 'production');
    await store.getEntry('posts', 'old');
    expect(warn).not.toHaveBeenCalled();
    vi.stubEnv('NODE_ENV', 'development');
    await store.getEntry('posts', 'old');
    await store.getEntry('posts', 'old');
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([expect.stringContaining('posts/old: "title"'), expect.stringContaining('posts/old: "related"')]);
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it('are not what the admin and the write path use: the plain store keeps the stored value', async () => {
    const entry = await createStore(cmsConfig, staleStorage()).getEntry('posts', 'old');
    expect(entry?.title).toEqual({ type: 'doc', content: [] });
  });
});
