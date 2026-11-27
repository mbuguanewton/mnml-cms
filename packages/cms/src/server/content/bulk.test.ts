import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createContentService } = await import('./content.js');
const { createHandlers } = await import('../admin/handlers.js');
const { runBulk, MAX_BULK } = await import('./bulk.js');
type EntryStorage = import('./storage.js').EntryStorage;
type Row = { collection: string; slug: string; data: unknown; status: string };

function memoryStorage(rows: Row[]): EntryStorage {
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
    remove: async (c, s) => {
      const row = find(c, s);
      if (row) rows.splice(rows.indexOf(row), 1);
    },
  };
}

const cmsConfig = config({
  home: singleton({ label: 'Home', fields: { title: fields.text('Title') } }),
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title', { required: true }) } }),
});

let rows: Row[] = [];
let admin = true;
const revalidate = vi.fn();
const featured: string[] = [];
const feature = vi.fn(async ({ slug, entry }: { slug: string; entry: Record<string, unknown> }) => {
  if (slug === 'p5') throw new Error('Search index is down');
  featured.push(`${slug}:${String(entry.title)}`);
});

const build = () => {
  rows = [
    { collection: 'posts', slug: 'p1', data: { title: 'One' }, status: 'draft' },
    { collection: 'posts', slug: 'p2', data: { title: 'Two' }, status: 'published' },
    { collection: 'posts', slug: 'p3', data: { title: '' }, status: 'draft' }, // can't publish: title is required
    { collection: 'posts', slug: 'p4', data: { title: 'Four' }, status: 'published' },
    { collection: 'posts', slug: 'p5', data: { title: 'Five' }, status: 'published' },
  ];
  return createContext(cmsConfig, {
    storage: memoryStorage(rows),
    auth: { isAdmin: async () => admin, loginUrl: '/sign-in' },
    revalidate,
    listActions: { posts: [{ name: 'feature', label: 'Feature', run: feature }] },
  }) as never;
};

let ctx: ReturnType<typeof build>;
let content: ReturnType<typeof createContentService>;
const bulk = (key: unknown, slugs: unknown, action: unknown) => runBulk(ctx, content, { key, slugs, action });
const status = (slug: string) => rows.find((r) => r.slug === slug)?.status;

beforeEach(() => {
  admin = true;
  revalidate.mockClear();
  feature.mockClear();
  featured.length = 0;
  ctx = build();
  content = createContentService(ctx);
});

describe('runBulk', () => {
  it('publishes drafts, skips what is live or missing, and reports an invalid one', async () => {
    const r = await bulk('posts', ['p1', 'p2', 'p3', 'nope'], 'publish');
    expect(r).toMatchObject({ ok: true, status: 200 });
    if (!r.ok) throw new Error();
    expect(r.results.done).toEqual(['p1']);
    expect(r.results.skipped).toEqual([
      { slug: 'p2', message: 'Already published.' },
      { slug: 'nope', message: 'This entry does not exist.' },
    ]);
    expect(r.results.failed).toHaveLength(1);
    expect(r.results.failed[0].slug).toBe('p3');
    expect(r.results.failed[0].message).toMatch(/title/);
    expect(status('p1')).toBe('published');
    expect(status('p3')).toBe('draft');
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('unpublishes live entries and skips drafts', async () => {
    const r = await bulk('posts', ['p2', 'p4', 'p1'], 'unpublish');
    if (!r.ok) throw new Error();
    expect(r.results).toEqual({ done: ['p2', 'p4'], skipped: [{ slug: 'p1', message: 'Already a draft.' }], failed: [] });
    expect([status('p2'), status('p4'), status('p5')]).toEqual(['draft', 'draft', 'published']);
  });

  it('deletes each entry once, even when a slug is repeated', async () => {
    const r = await bulk('posts', ['p4', 'p4', 'p1'], 'delete');
    if (!r.ok) throw new Error();
    expect(r.results).toEqual({ done: ['p4', 'p1'], skipped: [], failed: [] });
    expect(rows.filter((x) => x.collection === 'posts').map((x) => x.slug)).toEqual(['p2', 'p3', 'p5']);
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('runs a site action on each entry, and one that throws fails only that entry', async () => {
    const r = await bulk('posts', ['p1', 'p5', 'p2'], 'feature');
    if (!r.ok) throw new Error();
    expect(r.results).toEqual({ done: ['p1', 'p2'], skipped: [], failed: [{ slug: 'p5', message: 'Search index is down' }] });
    expect(featured).toEqual(['p1:One', 'p2:Two']);
  });

  it('refuses a bad request without touching anything', async () => {
    const big = Array.from({ length: MAX_BULK + 1 }, (_, i) => `s${i}`);
    for (const [key, slugs, action] of [
      ['nope', ['p1'], 'delete'],
      ['home', ['p1'], 'delete'],
      ['posts', ['p1'], 'explode'],
      ['posts', [], 'delete'],
      ['posts', big, 'delete'],
      ['posts', ['Not A Slug'], 'delete'],
      ['posts', ['p1', 3], 'delete'],
      ['posts', 'p1', 'delete'],
      [5, ['p1'], 'delete'],
    ] as const) {
      const r = await bulk(key, slugs, action);
      expect(r, JSON.stringify([key, action])).toMatchObject({ ok: false, status: 400 });
    }
    expect(rows).toHaveLength(5);
  });

  it('keeps a site action out of the built-in names', async () => {
    expect((await bulk('posts', ['p1'], 'feature')).ok).toBe(true);
    expect(await bulk('home', ['p1'], 'feature')).toMatchObject({ ok: false });
  });
});

describe('POST bulk', () => {
  const post = async (body: unknown) => {
    const handlers = createHandlers(ctx);
    const res = await handlers.POST(new Request('http://x/api/mnml/bulk', { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ route: ['bulk'] }),
    });
    return { status: res.status, body: await res.json() };
  };

  it('needs an admin', async () => {
    admin = false;
    expect((await post({ key: 'posts', slugs: ['p1'], action: 'delete' })).status).toBe(401);
    expect(rows).toHaveLength(5);
  });

  it('answers with per-entry results, or a 400', async () => {
    const ok = await post({ key: 'posts', slugs: ['p1', 'p2'], action: 'publish' });
    expect(ok).toEqual({ status: 200, body: { ok: true, results: { done: ['p1'], skipped: [{ slug: 'p2', message: 'Already published.' }], failed: [] } } });
    expect((await post({ key: 'posts', slugs: [], action: 'publish' })).status).toBe(400);
    expect((await post('not an object')).status).toBe(400);
  });
});
