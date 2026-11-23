import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));

const { collection, config, fields } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createHandlers } = await import('./handlers.js');
type EntryStorage = import('../content/storage.js').EntryStorage;

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

describe('POST media/list and media/delete', () => {
  const files = new Map<string, { size: number; uploadedAt: Date }>([
    ['old.png', { size: 10, uploadedAt: new Date('2026-01-01') }],
    ['new.png', { size: 20, uploadedAt: new Date('2026-03-01') }],
    ['mid.png', { size: 30, uploadedAt: new Date('2026-02-01') }],
    ['broken.png', { size: 40, uploadedAt: new Date('2026-02-15') }],
  ]);
  let signedIn = true;
  const build = (media: Partial<import('../media/media.js').MediaStorage> | undefined) =>
    createHandlers(
      createContext(cmsConfig, { storage: memoryStorage([]), auth: { isAdmin: async () => signedIn, loginUrl: '/sign-in' }, media: media as never }) as never,
    );
  const withList = build({
    list: async () => [...files].map(([key, f]) => ({ key, ...f })),
    delete: async (key) => {
      if (key === 'broken.png') throw new Error('Storage said no');
      files.delete(key);
    },
  });
  const post = async (h: typeof withList, route: string, body: unknown) => {
    const res = await h.POST(new Request(`http://x/api/mnml/${route}`, { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ route: route.split('/') }),
    });
    return { status: res.status, body: await res.json() };
  };

  beforeEach(() => {
    signedIn = true;
  });

  it('lists the files newest first, with their URLs', async () => {
    const r = await post(withList, 'media/list', {});
    expect(r.status).toBe(200);
    expect(r.body.files.map((f: { key: string }) => f.key)).toEqual(['new.png', 'broken.png', 'mid.png', 'old.png']);
    expect(r.body.files[0]).toEqual({ key: 'new.png', url: '/api/mnml/media/new.png', size: 20, uploadedAt: '2026-03-01T00:00:00.000Z' });
  });

  it('needs an admin, and a storage that can list', async () => {
    signedIn = false;
    expect((await post(withList, 'media/list', {})).status).toBe(401);
    expect((await post(withList, 'media/delete', { keys: ['old.png'] })).status).toBe(401);
    signedIn = true;
    expect((await post(build({ get: async () => null }), 'media/list', {})).status).toBe(501);
  });

  it('still deletes one file by key, and rejects a bad key', async () => {
    expect(await post(withList, 'media/delete', { key: 'old.png' })).toEqual({ status: 200, body: { ok: true } });
    expect(files.has('old.png')).toBe(false);
    expect((await post(withList, 'media/delete', { key: '../secret' })).status).toBe(400);
    expect((await post(withList, 'media/delete', { key: 5 })).status).toBe(400);
  });

  it('deletes a batch, and reports the files that failed', async () => {
    const r = await post(withList, 'media/delete', { keys: ['new.png', 'broken.png', 'new.png', 'mid.png'] });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, deleted: ['new.png', 'mid.png'], failed: [{ key: 'broken.png', message: 'Storage said no' }] });
    expect([...files.keys()]).toEqual(['broken.png']);
  });

  it('rejects an empty batch, a batch over 100, and any bad key in it', async () => {
    for (const keys of [[], Array.from({ length: 101 }, (_, i) => `f${i}.png`), ['ok.png', '../secret'], ['ok.png', 3], 'ok.png']) {
      const r = await post(withList, 'media/delete', { keys });
      expect(r.status, JSON.stringify(keys).slice(0, 40)).toBe(400);
    }
    expect([...files.keys()]).toEqual(['broken.png']);
  });

  it('says so when the storage cannot delete', async () => {
    expect((await post(build({ list: async () => [] }), 'media/delete', { keys: ['a.png'] })).status).toBe(501);
  });
});
