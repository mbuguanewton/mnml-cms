import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createHandlers } = await import('../admin/handlers.js');
const { revOf } = await import('./rev.js');
const { revalidateTag } = await import('next/cache');
type Row = { collection: string; slug: string; data: unknown; status: string };

const cmsConfig = config({
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title', { required: true }) } }),
});

let rows: Row[];
let revalidate: ReturnType<typeof vi.fn<(change: unknown) => void>>;
let onChange: ReturnType<typeof vi.fn<(change: unknown) => void>>;
let handlers: ReturnType<typeof createHandlers>;
const row = (c: string, s: string) => rows.find((r) => r.collection === c && r.slug === s);

/** The handlers over `rows`, with extra `createCms` options. */
function build(extra: { cache?: boolean } = {}) {
  const now = new Date();
  return createHandlers(
    createContext(cmsConfig, {
      storage: {
        readRow: async (c, s) => row(c, s),
        readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now })),
        upsert: async (c, s, data, status) => {
          const r = row(c, s);
          if (r) Object.assign(r, { data, status });
          else rows.push({ collection: c, slug: s, data, status });
        },
        insertIfAbsent: async (c, s, data, status) => (row(c, s) ? false : (rows.push({ collection: c, slug: s, data, status }), true)),
        remove: async (c, s) => {
          const r = row(c, s);
          if (r) rows.splice(rows.indexOf(r), 1);
        },
      },
      auth: { isAdmin: async () => true, loginUrl: '/' },
      revalidate,
      onChange,
      ...extra,
    }) as never,
  );
}

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
  rows = [{ collection: 'posts', slug: 'live', data: { title: 'Live' }, status: 'published' }];
  revalidate = vi.fn<(change: unknown) => void>();
  onChange = vi.fn<(change: unknown) => void>();
  handlers = build();
});

const post = async (route: string, body: unknown) => {
  const res = await handlers.POST(new Request(`http://x/api/mnml/${route}`, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ route: route.split('/') }),
  });
  return { status: res.status, body: await res.json() };
};

describe('admin writes through the content service', () => {
  it('creates and publishes, redirecting to the new entry', async () => {
    const r = await post('save', { key: 'posts', slug: 'fresh', mode: 'create', data: { title: 'Fresh' } });
    expect(r.body).toMatchObject({ ok: true, message: 'Published. The site is updated.', redirect: '/admin/posts/fresh?created=1' });
    expect(r.body).not.toHaveProperty('created');
    expect(row('posts', 'fresh')?.status).toBe('published');
    expect(revalidate).toHaveBeenCalledWith({ type: 'save', key: 'posts', slug: 'fresh' });
    expect(onChange).toHaveBeenCalledWith({ type: 'save', key: 'posts', slug: 'fresh' });
  });

  it('refuses a taken slug and invalid fields', async () => {
    expect((await post('save', { key: 'posts', slug: 'live', mode: 'create', data: { title: 'X' } })).body.errors).toEqual({ $slug: 'Already in use' });
    expect((await post('save', { key: 'posts', slug: 'x', mode: 'create', data: { title: '' } })).body.errors).toHaveProperty('title');
  });

  it('saves a draft of a published entry beside it without revalidating', async () => {
    const r = await post('save', { key: 'posts', slug: 'live', mode: 'update', action: 'draft', data: { title: 'Next' } });
    expect(r.body.message).toBe('Draft saved. The live site is unchanged.');
    expect(row('posts', 'live')?.data).toEqual({ title: 'Live' });
    expect(row('pending:posts', 'live')?.data).toEqual({ title: 'Next' });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('autosaves with a rev check', async () => {
    const def = cmsConfig.posts;
    const stale = await post('autosave', { key: 'posts', slug: 'live', mode: 'update', rev: 'old', data: { title: 'A' } });
    expect(stale.body).toMatchObject({ ok: false, conflict: true });
    const ok = await post('autosave', { key: 'posts', slug: 'live', mode: 'update', rev: revOf(def, { title: 'Live' }), data: { title: 'A' } });
    expect(ok.body).toEqual({ ok: true, rev: revOf(def, { title: 'A' }), changes: true });
    // Back to the live version: nothing pending.
    const back = await post('autosave', { key: 'posts', slug: 'live', mode: 'update', rev: revOf(def, { title: 'A' }), data: { title: 'Live' } });
    expect(back.body).toMatchObject({ ok: true, changes: false });
    expect(row('pending:posts', 'live')).toBeUndefined();
  });

  it('discards and deletes', async () => {
    rows.push({ collection: 'pending:posts', slug: 'live', data: { title: 'P' }, status: 'published' });
    expect((await post('discard', { key: 'posts', slug: 'live' })).body).toEqual({ ok: true });
    expect(row('pending:posts', 'live')).toBeUndefined();
    expect((await post('discard', { key: 'nope', slug: 'live' })).status).toBe(400);
    expect((await post('delete', { key: 'posts', slug: 'live' })).body).toEqual({ ok: true, redirect: '/admin/posts' });
    expect(row('posts', 'live')).toBeUndefined();
    expect(onChange).toHaveBeenCalledWith({ type: 'delete', key: 'posts', slug: 'live' });
  });
});

describe('read cache invalidation', () => {
  it("expires the key's tag on a publish and a delete, even with a custom revalidate", async () => {
    handlers = build({ cache: true });
    await post('save', { key: 'posts', slug: 'fresh', mode: 'create', data: { title: 'Fresh' } });
    expect(revalidateTag).toHaveBeenCalledWith('mnml:posts', { expire: 0 });
    expect(revalidate).toHaveBeenCalledTimes(1);
    vi.mocked(revalidateTag).mockClear();
    await post('delete', { key: 'posts', slug: 'fresh' });
    expect(revalidateTag).toHaveBeenCalledWith('mnml:posts', { expire: 0 });
  });

  it('leaves the cache alone for pending changes, and when it is off', async () => {
    handlers = build({ cache: true });
    await post('save', { key: 'posts', slug: 'live', mode: 'update', action: 'draft', data: { title: 'Next' } });
    expect(revalidateTag).not.toHaveBeenCalled();
    handlers = build();
    await post('save', { key: 'posts', slug: 'live', mode: 'update', data: { title: 'Now' } });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
