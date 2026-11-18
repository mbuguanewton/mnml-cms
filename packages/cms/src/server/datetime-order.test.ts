import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields } = await import('../define.js');
const { createStore } = await import('./store.js');
type EntryStorage = import('./storage.js').EntryStorage;

const now = new Date();
const rows = [
  { slug: 'b', at: '2026-11-18T09:00:00.000Z' },
  { slug: 'a', at: '2026-11-18T14:30:00.000Z' },
  { slug: 'c', at: '2025-12-31T23:59:00.000Z' },
  { slug: 'd', at: null },
].map(({ slug, at }) => ({ collection: 'posts', slug, data: { title: slug, at }, status: 'published', createdAt: now, updatedAt: now }));

const storage: EntryStorage = {
  readRow: async (c, s) => rows.find((r) => r.collection === c && r.slug === s),
  readRows: async (c) => rows.filter((r) => r.collection === c),
  upsert: async () => {},
  insertIfAbsent: async () => true,
  remove: async () => {},
};

const store = createStore(
  config({
    posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title'), at: fields.datetime('At') } }),
  }),
  storage,
);

describe('orderBy a datetime field', () => {
  it('sorts chronologically, empty values last', async () => {
    expect((await store.listEntries('posts', { orderBy: 'at' })).map((e) => e.slug)).toEqual(['c', 'b', 'a', 'd']);
    expect((await store.listEntries('posts', { orderBy: 'at', order: 'desc' })).map((e) => e.slug)).toEqual(['a', 'b', 'c', 'd']);
  });
});
