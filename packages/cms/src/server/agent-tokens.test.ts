import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../define.js');
const { createContext } = await import('./context.js');
const { createHandlers } = await import('./handlers.js');
const { agentTokens, hashToken, TOKENS } = await import('./agent-tokens.js');
type EntryStorage = import('./storage.js').EntryStorage;
type Row = { collection: string; slug: string; data: unknown; status: string };

const cmsConfig = config({
  settings: singleton({ label: 'Settings', fields: { siteName: fields.text('Site name') } }),
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/posts', fields: { title: fields.text('Title') } }),
});
const CONFIG_TOKEN = 'c'.repeat(32);

let rows: Row[];
let admin: boolean;
let ctx: ReturnType<typeof createContext>;
let handlers: ReturnType<typeof createHandlers>;

function memoryStorage(): EntryStorage {
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

beforeEach(() => {
  rows = [{ collection: 'posts', slug: 'hello', data: { title: 'Hello' }, status: 'published' }];
  admin = true;
  ctx = createContext(cmsConfig, {
    storage: memoryStorage(),
    auth: { isAdmin: async () => admin, loginUrl: '/' },
    mcp: { adminTokens: true, tokens: [{ name: 'ci', token: CONFIG_TOKEN, scopes: ['read'] }] },
  }) as never;
  handlers = createHandlers(ctx as never);
});

const post = async (route: string, body: unknown) => {
  const res = await handlers.POST(new Request(`http://x/api/mnml/${route}`, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ route: route.split('/') }),
  });
  return { status: res.status, body: await res.json() };
};

let rpcId = 1;
async function rpc(token: string, method: string, params?: unknown) {
  const res = await handlers.POST(
    new Request('http://x/api/mnml/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
    }),
    { params: Promise.resolve({ route: ['mcp'] }) },
  );
  return { status: res.status, body: await res.json() };
}
const tools = async (token: string) => (await rpc(token, 'tools/list')).body.result.tools.map((t: { name: string }) => t.name);

describe('admin-created agent tokens', () => {
  it('creates a token shown once and stores only its hash', async () => {
    const r = await post('tokens/create', { name: 'claude', scopes: ['read', 'draft'] });
    expect(r.body).toMatchObject({ ok: true });
    expect(r.body.token).toMatch(/^mnml_[\w-]{43}$/);
    const stored = rows.filter((x) => x.collection === TOKENS);
    expect(stored).toHaveLength(1);
    expect(stored[0].slug).toBe(hashToken(r.body.token));
    expect(JSON.stringify(stored[0].data)).not.toContain(r.body.token);
    expect(stored[0].data).toMatchObject({ name: 'claude', scopes: ['read', 'draft'], collections: null, lastUsedAt: null });
  });

  it('signs agents in with it, with its scopes and content', async () => {
    const { body } = await post('tokens/create', { name: 'posts-writer', scopes: ['read', 'draft'], collections: ['posts'] });
    const names = await tools(body.token);
    expect(names).toContain('create_entry');
    expect(names).not.toContain('publish');
    const schema = await rpc(body.token, 'tools/call', { name: 'get_schema', arguments: {} });
    expect(JSON.parse(schema.body.result.content[0].text).content.map((c: { key: string }) => c.key)).toEqual(['posts']);
  });

  it('gives 401 after revoke', async () => {
    const { body } = await post('tokens/create', { name: 'temp', scopes: ['read'] });
    expect((await rpc(body.token, 'ping')).status).toBe(200);
    expect((await post('tokens/revoke', { id: hashToken(body.token) })).body).toEqual({ ok: true });
    expect((await rpc(body.token, 'ping')).status).toBe(401);
  });

  it('records last used at most once a minute', async () => {
    const { body } = await post('tokens/create', { name: 'busy', scopes: ['read'] });
    const row = () => rows.find((x) => x.collection === TOKENS)!.data as { lastUsedAt: string | null };
    await rpc(body.token, 'ping');
    const first = row().lastUsedAt;
    expect(first).not.toBeNull();
    await rpc(body.token, 'ping');
    expect(row().lastUsedAt).toBe(first);
    const tokens = agentTokens(ctx as never);
    const hit = (await tokens.find(body.token))!;
    await tokens.touch(hit.id, hit.data, Date.parse(first!) + 61_000);
    expect(row().lastUsedAt).not.toBe(first);
  });

  it('keeps config tokens working', async () => {
    expect(await tools(CONFIG_TOKEN)).toContain('get_schema');
    expect(await tools(CONFIG_TOKEN)).not.toContain('create_entry');
  });

  it('refuses duplicate names (config names too) and bad input', async () => {
    await post('tokens/create', { name: 'claude', scopes: ['read'] });
    expect((await post('tokens/create', { name: 'Claude', scopes: ['read'] })).body.errors).toEqual({ name: 'Already in use' });
    expect((await post('tokens/create', { name: 'ci', scopes: ['read'] })).body.errors).toEqual({ name: 'Already in use' });
    const bad = await post('tokens/create', { name: '', scopes: [], collections: ['nope'] });
    expect(Object.keys(bad.body.errors).sort()).toEqual(['collections.0', 'name', 'scopes']);
  });

  it('is admin only, and off without adminTokens', async () => {
    admin = false;
    expect((await post('tokens/create', { name: 'x', scopes: ['read'] })).status).toBe(401);
    expect((await post('tokens/revoke', { id: 'a'.repeat(64) })).status).toBe(401);

    const plain = createHandlers(
      createContext(cmsConfig, { storage: memoryStorage(), auth: { isAdmin: async () => true, loginUrl: '/' }, mcp: { tokens: [] } }) as never,
    );
    const res = await plain.POST(new Request('http://x/api/mnml/tokens/create', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ route: ['tokens', 'create'] }),
    });
    expect(res.status).toBe(404);
  });

  it('turns the MCP route on with only adminTokens', async () => {
    const only = createHandlers(
      createContext(cmsConfig, { storage: memoryStorage(), auth: { isAdmin: async () => true, loginUrl: '/' }, mcp: { adminTokens: true } }) as never,
    );
    const res = await only.POST(new Request('http://x/api/mnml/mcp', { method: 'POST', body: '{}' }), { params: Promise.resolve({ route: ['mcp'] }) });
    expect(res.status).toBe(401);
  });
});
