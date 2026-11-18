import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));

const { collection, config, fields } = await import('../define.js');
const { createContext } = await import('./context.js');
const { createHandlers } = await import('./handlers.js');
type EntryStorage = import('./storage.js').EntryStorage;

/** An in-memory EntryStorage. */
function memoryStorage(rows: { collection: string; slug: string; data: unknown; status: string }[]): EntryStorage {
  const now = new Date();
  const find = (c: string, s: string) => rows.find((r) => r.collection === c && r.slug === s);
  return {
    readRow: async (c, s) => find(c, s),
    readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now })),
    upsert: async (c, s, data, status) => {
      const row = find(c, s);
      if (row) Object.assign(row, { data, status });
      else rows.push({ collection: c, slug: s, data, status });
    },
    insertIfAbsent: async (c, s, data, status) => (find(c, s) ? false : (rows.push({ collection: c, slug: s, data, status }), true)),
    remove: async (c, s) => void rows.splice(rows.indexOf(find(c, s)!), 1),
  };
}

const cmsConfig = config({
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title') } }),
  authors: collection({ label: 'Authors', titleField: 'name', basePath: '/authors', fields: { name: fields.text('Name') } }),
});

let admin = true;
const handlers = createHandlers(
  createContext(cmsConfig, {
    storage: memoryStorage([
      { collection: 'posts', slug: 'b-post', data: { title: 'Beta' }, status: 'published' },
      { collection: 'posts', slug: 'a-post', data: { title: 'Alpha' }, status: 'published' },
      { collection: 'posts', slug: 'draft-post', data: { title: 'Draft' }, status: 'draft' },
      { collection: 'authors', slug: 'ada', data: { name: '' }, status: 'published' },
    ]),
    auth: { isAdmin: async () => admin, loginUrl: '/sign-in' },
  }) as never,
);

const call = async (body: unknown) => {
  const res = await handlers.POST(new Request('http://x/api/mnml/references', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ route: ['references'] }),
  });
  return { status: res.status, body: await res.json() };
};

describe('POST references', () => {
  beforeEach(() => {
    admin = true;
  });

  it('lists published entries by title, with the slug as fallback label', async () => {
    expect(await call({ collections: ['posts', 'authors'] })).toEqual({
      status: 200,
      body: {
        ok: true,
        options: {
          posts: [
            { slug: 'a-post', label: 'Alpha' },
            { slug: 'b-post', label: 'Beta' },
          ],
          authors: [{ slug: 'ada', label: 'ada' }],
        },
      },
    });
  });

  it('skips unknown collections and rejects a bad body', async () => {
    expect((await call({ collections: ['nope'] })).body).toEqual({ ok: true, options: {} });
    expect((await call({ collections: 'posts' })).status).toBe(400);
  });

  it('refuses non-admins', async () => {
    admin = false;
    expect((await call({ collections: ['posts'] })).status).toBe(401);
  });
});
