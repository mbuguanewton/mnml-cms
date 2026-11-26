import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

// An index in memory: a passage matches when it has every word of the query.
type Passage = { id: string; key: string; slug: string | null; field: string; text: string; title: string; url: string | null };
const stored = vi.hoisted(() => ({ passages: [] as Passage[] }));
const memory = {
  put: async (e: { id: string; key: string; slug: string | null; title: string; url: string | null; chunks: { field: string; text: string }[] }) => {
    stored.passages = stored.passages.filter((p) => p.id !== e.id);
    for (const c of e.chunks) stored.passages.push({ id: e.id, key: e.key, slug: e.slug, field: c.field, text: c.text, title: e.title, url: e.url });
  },
  remove: async (id: string) => {
    stored.passages = stored.passages.filter((p) => p.id !== id);
  },
  query: async (q: string, o: { collections?: string[] }) =>
    stored.passages
      .filter(
        (p) =>
          (!o.collections || o.collections.includes(p.key)) &&
          (q.toLowerCase().match(/\w+/g) ?? []).every((w) => `${p.title} ${p.text}`.toLowerCase().includes(w)),
      )
      .map((p) => ({ ...p, score: 1 })),
};

const { collection, config, fields } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createHandlers } = await import('../admin/handlers.js');
type EntryStorage = import('../content/storage.js').EntryStorage;
type Row = { collection: string; slug: string; data: unknown; status: string };

const cmsConfig = config({
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    fields: { title: fields.text('Title', { required: true }), body: fields.textarea('Body') },
  }),
  notes: collection({
    label: 'Notes',
    titleField: 'title',
    basePath: '/notes',
    fields: { title: fields.text('Title', { required: true }), body: fields.textarea('Body') },
  }),
});

let rows: Row[];
const storage = (): EntryStorage => {
  const find = (c: string, s: string) => rows.find((r) => r.collection === c && r.slug === s);
  const now = new Date();
  return {
    readRow: async (c, s) => find(c, s),
    readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now })),
    upsert: async (c, s, data, status) => {
      const r = find(c, s);
      if (r) Object.assign(r, { data, status });
      else rows.push({ collection: c, slug: s, data, status });
    },
    insertIfAbsent: async (c, s, data, status) => (find(c, s) ? false : (rows.push({ collection: c, slug: s, data, status }), true)),
    remove: async (c, s) => {
      const r = find(c, s);
      if (r) rows.splice(rows.indexOf(r), 1);
    },
  };
};

const TOKEN = 't'.repeat(32);
const NOTES_TOKEN = 'n'.repeat(32);
function build(search: unknown) {
  const ctx = createContext(cmsConfig, {
    storage: storage(),
    auth: { isAdmin: async () => true, loginUrl: '/' },
    revalidate: () => {},
    mcp: {
      tokens: [
        { name: 'reader', token: TOKEN, scopes: ['read'] },
        { name: 'notes', token: NOTES_TOKEN, scopes: ['read'], collections: ['notes'] },
      ],
    },
    search: search === undefined ? undefined : { index: memory, ...(search as object) },
  } as never);
  return { ctx, handlers: createHandlers(ctx) };
}

let app: ReturnType<typeof build>;
// `after()` is mocked to run without being awaited, so let it finish.
const settle = () => new Promise((r) => setTimeout(r, 0));
const post = async (route: string, body: unknown) => {
  const res = await app.handlers.POST(new Request(`http://x/api/mnml/${route}`, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ route: [route] }),
  });
  const out = await res.json();
  await settle();
  return out;
};
const save = (body: unknown) => post('save', body);
const find = (url: string, ip = '1.1.1.1') =>
  app.handlers.GET(new Request(`http://x/api/mnml/search${url}`, { headers: { 'x-forwarded-for': ip } }), { params: Promise.resolve({ route: ['search'] }) });
async function tool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await app.handlers.POST(
    new Request('http://x/api/mnml/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    }),
    { params: Promise.resolve({ route: ['mcp'] }) },
  );
  const { result } = await res.json();
  return { isError: result.isError as boolean, ...JSON.parse(result.content[0].text) };
}

beforeEach(() => {
  stored.passages = [];
  rows = [];
  app = build({ route: true });
});

describe('the index follows the write path', () => {
  it('indexes on publish, ignores drafts, and drops on unpublish and delete', async () => {
    await save({ key: 'posts', slug: 'a', mode: 'create', data: { title: 'Alpha', body: 'refund policy' } });
    expect((await app.ctx.search!.query('refund')).map((h) => h.slug)).toEqual(['a']);

    // A draft of a published entry is pending changes: the live text stays searchable, the draft text does not.
    await save({ key: 'posts', slug: 'a', mode: 'update', action: 'draft', data: { title: 'Alpha', body: 'secret rewrite' } });
    expect(await app.ctx.search!.query('secret')).toEqual([]);
    expect(await app.ctx.search!.query('refund')).toHaveLength(1);

    await save({ key: 'posts', slug: 'b', mode: 'create', action: 'draft', data: { title: 'Beta', body: 'refund draft' } });
    expect((await app.ctx.search!.query('refund')).map((h) => h.slug)).toEqual(['a']);

    await save({ key: 'posts', slug: 'a', mode: 'update', action: 'unpublish', data: { title: 'Alpha', body: 'refund policy' } });
    expect(await app.ctx.search!.query('refund')).toEqual([]);

    await save({ key: 'posts', slug: 'c', mode: 'create', data: { title: 'Gamma', body: 'refund again' } });
    expect(await app.ctx.search!.query('refund')).toHaveLength(1);
    await post('delete', { key: 'posts', slug: 'c' });
    expect(await app.ctx.search!.query('refund')).toEqual([]);
  });

  it('never fails a save when indexing fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(app.ctx.search!, 'sync').mockRejectedValue(new Error('db down'));
    expect(await save({ key: 'posts', slug: 'a', mode: 'create', data: { title: 'Alpha', body: 'text' } })).toMatchObject({ ok: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('createContext', () => {
  it('has no index when search is off', () => {
    expect(build(undefined).ctx.search).toBeNull();
  });

  it('refuses a route list with a collection that is not in the config', () => {
    expect(() =>
      createContext(cmsConfig, { storage: storage(), auth: { isAdmin: async () => true }, search: { index: memory, route: ['nope'] } } as never),
    ).toThrow('"nope"');
  });

  it('feeds the index from any storage', async () => {
    const custom = createContext(cmsConfig, {
      storage: storage(),
      auth: { isAdmin: async () => true },
      revalidate: () => {},
      search: { index: memory },
    } as never);
    const handlers = createHandlers(custom);
    await handlers.POST(
      new Request('http://x/api/mnml/save', {
        method: 'POST',
        body: JSON.stringify({ key: 'posts', slug: 'c', mode: 'create', data: { title: 'Custom', body: 'bring your own index' } }),
      }),
      {
        params: Promise.resolve({ route: ['save'] }),
      },
    );
    await settle();
    expect((await custom.search!.query('own index')).map((h) => h.slug)).toEqual(['c']);
  });
});

describe('GET /search', () => {
  beforeEach(async () => {
    await save({ key: 'posts', slug: 'a', mode: 'create', data: { title: 'Alpha', body: 'refund policy' } });
    await save({ key: 'notes', slug: 'n', mode: 'create', data: { title: 'Note', body: 'refund note' } });
  });

  it('is a 404 unless `route` is on', async () => {
    app = build({});
    expect((await find('?q=refund')).status).toBe(404);
  });

  it('searches published content, with collections and limit', async () => {
    const res = await find('?q=refund');
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results.map((r: { slug: string }) => r.slug).sort()).toEqual(['a', 'n']);
    expect(results[0]).toMatchObject({ field: 'body', text: expect.any(String), snippet: expect.any(String) });
    expect((await (await find('?q=refund&collections=notes')).json()).results).toHaveLength(1);
  });

  it('limits an anonymous visitor to the collections in `route`', async () => {
    app = build({ route: ['posts'] });
    await save({ key: 'posts', slug: 'a', mode: 'create', data: { title: 'Alpha', body: 'refund policy' } });
    await save({ key: 'notes', slug: 'n', mode: 'create', data: { title: 'Note', body: 'refund note' } });
    const slugs = async (q: string) => (await (await find(q)).json()).results.map((r: { slug: string }) => r.slug);
    expect(await slugs('?q=refund')).toEqual(['a']);
    expect(await slugs('?q=refund&collections=notes')).toEqual([]);
    expect(await slugs('?q=refund&collections=notes,posts')).toEqual(['a']);
    // The site's own cms.search() is not limited by it.
    expect((await app.ctx.search!.query('refund')).map((h) => h.slug).sort((x, y) => (x ?? '').localeCompare(y ?? ''))).toEqual(['a', 'n']);
  });

  it('caps all clients together, whatever x-forwarded-for says', async () => {
    let limited = 0;
    for (let i = 0; i < 305; i++) if ((await find('?q=refund', `10.0.${i >> 8}.${i & 255}`)).status === 429) limited++;
    expect(limited).toBeGreaterThanOrEqual(5);
  });

  it('rejects a missing or oversized query', async () => {
    expect((await find('')).status).toBe(400);
    expect((await find(`?q=${'x'.repeat(201)}`)).status).toBe(400);
  });

  it('limits each client to 30 a minute', async () => {
    for (let i = 0; i < 30; i++) expect((await find('?q=refund', '9.9.9.9')).status).toBe(200);
    const res = await find('?q=refund', '9.9.9.9');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await find('?q=refund', '8.8.8.8')).status).toBe(200);
  });
});

describe('MCP search_content', () => {
  beforeEach(async () => {
    await save({ key: 'posts', slug: 'a', mode: 'create', data: { title: 'Alpha', body: 'refund policy' } });
    await save({ key: 'notes', slug: 'n', mode: 'create', data: { title: 'Note', body: 'refund note' } });
  });

  it('searches published content', async () => {
    const r = await tool(TOKEN, 'search_content', { query: 'refund' });
    expect(r.total).toBe(2);
    expect(r.results[0]).toMatchObject({ collection: expect.any(String), slug: expect.any(String), url: expect.any(String), text: expect.any(String) });
  });

  it("stays inside the token's collections", async () => {
    const r = await tool(NOTES_TOKEN, 'search_content', { query: 'refund' });
    expect(r.results.map((x: { collection: string }) => x.collection)).toEqual(['notes']);
    expect((await tool(NOTES_TOKEN, 'search_content', { query: 'refund', collections: ['posts'] })).isError).toBe(true);
  });

  it('is not offered when search is off', async () => {
    app = build(undefined);
    const res = await app.handlers.POST(
      new Request('http://x/api/mnml/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      { params: Promise.resolve({ route: ['mcp'] }) },
    );
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('search');
    expect(names).not.toContain('search_content');
  });
});
