import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../define.js');
const { createContext } = await import('./context.js');
const { createHandlers } = await import('./handlers.js');
type EntryStorage = import('./storage.js').EntryStorage;
type Row = { collection: string; slug: string; data: unknown; status: string };

function memoryStorage(rows: Row[]): EntryStorage {
  const now = new Date('2026-01-01T00:00:00Z');
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
  settings: singleton({ label: 'Settings', fields: { siteName: fields.text('Site name') } }),
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    fields: {
      title: fields.text('Title', { required: true }),
      kind: fields.select('Kind', ['news', 'guide']),
      body: fields.textarea('Body'),
      content: fields.richtext('Content'),
    },
  }),
  pages: collection({ label: 'Pages', titleField: 'title', basePath: '', fields: { title: fields.text('Title') } }),
});

const TOKENS = { reader: 'r'.repeat(32), writer: 'w'.repeat(32), editor: 'e'.repeat(32), postsOnly: 'p'.repeat(32) };

let rows: Row[];
let revalidate: ReturnType<typeof vi.fn<(change: unknown) => void>>;
let onChange: ReturnType<typeof vi.fn<(change: unknown) => void>>;
let handlers: ReturnType<typeof createHandlers>;
let admin = false;

beforeEach(() => {
  admin = false;
  rows = [
    { collection: 'posts', slug: 'live', data: { title: 'Live post', kind: 'news', body: 'Hello world' }, status: 'published' },
    { collection: 'posts', slug: 'draft-one', data: { title: 'Draft one', kind: null, body: '' }, status: 'draft' },
  ];
  revalidate = vi.fn<(change: unknown) => void>();
  onChange = vi.fn<(change: unknown) => void>();
  handlers = createHandlers(
    createContext(cmsConfig, {
      storage: memoryStorage(rows),
      auth: { isAdmin: async () => admin, loginUrl: '/sign-in' },
      revalidate,
      onChange,
      mcp: {
        tokens: [
          { name: 'reader', token: TOKENS.reader, scopes: ['read'] },
          { name: 'writer', token: TOKENS.writer },
          { name: 'editor', token: TOKENS.editor, scopes: ['read', 'draft', 'publish', 'delete'] },
          { name: 'posts-only', token: TOKENS.postsOnly, collections: ['posts'] },
          { name: 'unset', token: undefined },
        ],
      },
    }) as never,
  );
});

let nextId = 1;
async function rpc(token: string | null, method: string, params?: unknown) {
  const res = await handlers.POST(
    new Request('http://x/api/mnml/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    }),
    { params: Promise.resolve({ route: ['mcp'] }) },
  );
  return { status: res.status, body: await res.json() };
}

async function call(token: string, name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc(token, 'tools/call', { name, arguments: args });
  return { isError: body.result.isError as boolean, ...JSON.parse(body.result.content[0].text) };
}

/** An editor's answer in the admin. */
async function answer(slug: string, approve: boolean) {
  admin = true;
  const res = await handlers.POST(new Request('http://x/api/mnml/request', { method: 'POST', body: JSON.stringify({ key: 'posts', slug, approve }) }), {
    params: Promise.resolve({ route: ['request'] }),
  });
  admin = false;
  return res.json();
}

const row = (c: string, s: string) => rows.find((r) => r.collection === c && r.slug === s);

describe('MCP auth', () => {
  it('refuses a missing or wrong token with 401', async () => {
    expect((await rpc(null, 'tools/list')).status).toBe(401);
    expect((await rpc('x'.repeat(32), 'tools/list')).status).toBe(401);
  });

  it('answers initialize and ping', async () => {
    const init = await rpc(TOKENS.reader, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.body.result.protocolVersion).toBe('2025-06-18');
    expect(init.body.result.capabilities.tools).toBeDefined();
    expect((await rpc(TOKENS.reader, 'ping')).body.result).toEqual({});
  });

  it('is off without the mcp option or a usable token', async () => {
    const plain = createHandlers(createContext(cmsConfig, { storage: memoryStorage([]), auth: { isAdmin: async () => true, loginUrl: '/' } }) as never);
    const res = await plain.POST(new Request('http://x/api/mnml/mcp', { method: 'POST', body: '{}' }), { params: Promise.resolve({ route: ['mcp'] }) });
    expect(res.status).toBe(404);
    const unset = createHandlers(
      createContext(cmsConfig, {
        storage: memoryStorage([]),
        auth: { isAdmin: async () => true, loginUrl: '/' },
        mcp: { tokens: [{ token: undefined }] },
      }) as never,
    );
    const res2 = await unset.POST(new Request('http://x/api/mnml/mcp', { method: 'POST', body: '{}' }), { params: Promise.resolve({ route: ['mcp'] }) });
    expect(res2.status).toBe(404);
  });

  it('lists only the tools a token has scopes for', async () => {
    const names = async (t: string) => (await rpc(t, 'tools/list')).body.result.tools.map((x: { name: string }) => x.name);
    const read = await names(TOKENS.reader);
    expect(read).toContain('get_schema');
    expect(read).not.toContain('create_entry');
    expect(await names(TOKENS.writer)).toContain('create_entry');
    expect(await names(TOKENS.writer)).not.toContain('publish');
    expect(await names(TOKENS.editor)).toEqual(expect.arrayContaining(['publish', 'unpublish', 'discard_draft', 'delete_entry']));
  });

  it('names the missing scope', async () => {
    const r = await call(TOKENS.writer, 'publish', { collection: 'posts', slug: 'draft-one' });
    expect(r.isError).toBe(true);
    expect(r.message).toContain('"publish" scope');
    expect(row('posts', 'draft-one')?.status).toBe('draft');
  });

  it('limits a token to its collections', async () => {
    const schema = await call(TOKENS.postsOnly, 'get_schema');
    expect(schema.content.map((c: { key: string }) => c.key)).toEqual(['posts']);
    const r = await call(TOKENS.postsOnly, 'get_entry', { collection: 'settings' });
    expect(r.isError).toBe(true);
    expect(r.errors.collection).toBeDefined();
  });
});

describe('MCP schema', () => {
  it('matches the config, select options included', async () => {
    const posts = (await call(TOKENS.reader, 'get_schema')).content.find((c: { key: string }) => c.key === 'posts');
    expect(posts).toMatchObject({ kind: 'collection', titleField: 'title', basePath: '/posts' });
    expect(posts.data.required).toEqual(['title']);
    expect(posts.data.properties.kind.enum).toEqual(['news', 'guide', null]);
    expect(posts.data.properties.content.anyOf[0]).toEqual({ type: 'string', description: 'Markdown' });
    expect((await call(TOKENS.reader, 'get_schema')).notes.join(' ')).not.toMatch(/delete_entry|discard_draft/);
    expect((await call(TOKENS.editor, 'get_schema')).notes.join(' ')).toContain('delete_entry and discard_draft only ask');
  });

  it('builds the collection enum of tool inputs from the config', async () => {
    const tools = (await rpc(TOKENS.writer, 'tools/list')).body.result.tools;
    const create = tools.find((t: { name: string }) => t.name === 'create_entry');
    expect(create.inputSchema.properties.collection.enum).toEqual(['posts', 'pages']);
  });
});

describe('MCP docs', () => {
  it('points to the matching docs pages', async () => {
    const r = await call(TOKENS.reader, 'docs', { topic: 'blocks sections' });
    expect(r.pages[0]).toMatchObject({ title: 'Blocks', url: 'https://mnml-cms.vercel.app/fields/blocks' });
    expect(r.pages[0].sections.length).toBeGreaterThan(0);
  });

  it('lists every page without a topic, and every page has a description', async () => {
    const r = await call(TOKENS.reader, 'docs');
    expect(r.pages.length).toBeGreaterThan(20);
    expect(r.pages.every((p: { url: string; description: string }) => p.url.startsWith('https://') && p.description.length > 10)).toBe(true);
  });

  it('falls back to every page when nothing matches', async () => {
    const r = await call(TOKENS.reader, 'docs', { topic: 'zzzz' });
    expect(r.pages).toEqual([]);
    expect(r.all.length).toBeGreaterThan(20);
  });
});

describe('MCP reads', () => {
  it('lists entries with status and timestamps', async () => {
    const r = await call(TOKENS.reader, 'list_entries', { collection: 'posts', fields: ['title'] });
    expect(r.total).toBe(2);
    expect(r.entries[0]).toEqual({
      slug: 'draft-one',
      status: 'draft',
      hasDraftChanges: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      entry: { title: 'Draft one' },
    });
    expect((await call(TOKENS.reader, 'list_entries', { collection: 'posts', status: 'published' })).total).toBe(1);
  });

  it('searches text', async () => {
    const r = await call(TOKENS.reader, 'search', { query: 'WORLD' });
    expect((await call(TOKENS.reader, 'search', { query: 'wor(' })).total).toBe(0);
    expect(r.results).toEqual([{ collection: 'posts', slug: 'live', title: 'Live post', status: 'published', snippet: 'Hello world' }]);
  });
});

describe('MCP writes', () => {
  it('creates a draft, with per-field errors when invalid', async () => {
    const bad = await call(TOKENS.writer, 'create_entry', { collection: 'posts', data: { title: '', kind: 'opinion', subtitle: 'x' } });
    expect(bad.isError).toBe(true);
    expect(bad.errors).toEqual({ subtitle: 'Not a field. See get_schema.' });
    const invalid = await call(TOKENS.writer, 'create_entry', { collection: 'posts', data: { title: '', kind: 'opinion' } });
    expect(Object.keys(invalid.errors).sort()).toEqual(['$slug', 'kind', 'title']);

    const ok = await call(TOKENS.writer, 'create_entry', { collection: 'posts', data: { title: 'New Post' } });
    expect(ok).toMatchObject({ ok: true, slug: 'new-post', status: 'draft' });
    expect(row('posts', 'new-post')).toMatchObject({ status: 'draft', data: { title: 'New Post', kind: null, body: '' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'save', key: 'posts', slug: 'new-post', by: 'writer' });
  });

  it('keeps the live version of a published entry until publish', async () => {
    const r = await call(TOKENS.writer, 'update_entry', { collection: 'posts', slug: 'live', data: { title: 'Edited' } });
    expect(r).toMatchObject({ ok: true, changes: true });
    expect(row('posts', 'live')).toMatchObject({ status: 'published', data: { title: 'Live post' } });
    expect(row('pending:posts', 'live')?.data).toMatchObject({ title: 'Edited', kind: 'news', body: 'Hello world' });
    expect(revalidate).not.toHaveBeenCalled();

    const diff = await call(TOKENS.reader, 'diff_entry', { collection: 'posts', slug: 'live' });
    expect(diff.changes).toEqual([{ field: 'title', live: 'Live post', draft: 'Edited' }]);
    expect((await call(TOKENS.reader, 'get_entry', { collection: 'posts', slug: 'live' })).entry.title).toBe('Edited');

    const pub = await call(TOKENS.editor, 'publish', { collection: 'posts', slug: 'live' });
    expect(pub.ok).toBe(true);
    expect(row('posts', 'live')).toMatchObject({ status: 'published', data: { title: 'Edited' } });
    expect(row('pending:posts', 'live')).toBeUndefined();
    expect(revalidate).toHaveBeenCalledWith({ type: 'save', key: 'posts', slug: 'live', by: 'editor' });
    expect(onChange).toHaveBeenCalledWith({ type: 'save', key: 'posts', slug: 'live', by: 'editor' });
  });

  it('discards a draft only after an editor approves', async () => {
    await call(TOKENS.editor, 'update_entry', { collection: 'posts', slug: 'live', data: { body: 'Changed' } });
    const r = await call(TOKENS.editor, 'discard_draft', { collection: 'posts', slug: 'live' });
    expect(r).toMatchObject({ ok: true, status: 'awaiting_approval', approveUrl: 'http://x/admin/posts/live' });
    expect(row('pending:posts', 'live')).toBeDefined();
    expect((await call(TOKENS.reader, 'get_entry', { collection: 'posts', slug: 'live' })).awaitingApproval).toMatchObject({ action: 'discard', by: 'editor' });
    expect(await answer('live', true)).toMatchObject({ ok: true });
    expect(row('pending:posts', 'live')).toBeUndefined();
    expect(row('request:posts', 'live')).toBeUndefined();
  });

  it('refuses an approved discard when the draft changed after the request', async () => {
    await call(TOKENS.editor, 'update_entry', { collection: 'posts', slug: 'live', data: { body: 'One' } });
    await call(TOKENS.editor, 'discard_draft', { collection: 'posts', slug: 'live' });
    await call(TOKENS.editor, 'update_entry', { collection: 'posts', slug: 'live', data: { body: 'Two' } });
    expect(await answer('live', true)).toMatchObject({ ok: false });
    expect(row('pending:posts', 'live')?.data).toMatchObject({ body: 'Two' });
  });

  it('drops a discard request once the draft is published', async () => {
    await call(TOKENS.editor, 'update_entry', { collection: 'posts', slug: 'live', data: { body: 'One' } });
    await call(TOKENS.editor, 'discard_draft', { collection: 'posts', slug: 'live' });
    await call(TOKENS.editor, 'publish', { collection: 'posts', slug: 'live' });
    expect(row('request:posts', 'live')).toBeUndefined();
  });

  it('has nothing to discard without unpublished changes', async () => {
    expect((await call(TOKENS.editor, 'discard_draft', { collection: 'posts', slug: 'live' })).isError).toBe(true);
  });

  it('unpublishes', async () => {
    await call(TOKENS.editor, 'unpublish', { collection: 'posts', slug: 'live' });
    expect(row('posts', 'live')?.status).toBe('draft');
  });

  it('saves a singleton without drafts only with the publish scope', async () => {
    const denied = await call(TOKENS.writer, 'update_entry', { collection: 'settings', data: { siteName: 'Site' } });
    expect(denied.message).toContain('publish scope');
    expect(row('settings', 'singleton')).toBeUndefined();
    const ok = await call(TOKENS.editor, 'update_entry', { collection: 'settings', data: { siteName: 'Site' } });
    expect(ok.ok).toBe(true);
    expect(row('settings', 'singleton')).toMatchObject({ status: 'published', data: { siteName: 'Site' } });
  });

  it('deletes only after an editor approves', async () => {
    const r = await call(TOKENS.editor, 'delete_entry', { collection: 'posts', slug: 'live' });
    expect(r).toMatchObject({ ok: true, status: 'awaiting_approval' });
    expect(row('posts', 'live')).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    expect(await answer('live', false)).toMatchObject({ ok: true });
    expect(row('posts', 'live')).toBeDefined();
    expect(row('request:posts', 'live')).toBeUndefined();

    await call(TOKENS.editor, 'delete_entry', { collection: 'posts', slug: 'live' });
    expect(await answer('live', true)).toMatchObject({ ok: true, redirect: '/admin/posts' });
    expect(row('posts', 'live')).toBeUndefined();
    expect(onChange).toHaveBeenCalledWith({ type: 'delete', key: 'posts', slug: 'live', by: 'editor' });
  });

  it('refuses non-admins answering a request', async () => {
    await call(TOKENS.editor, 'delete_entry', { collection: 'posts', slug: 'live' });
    const res = await handlers.POST(
      new Request('http://x/api/mnml/request', { method: 'POST', body: JSON.stringify({ key: 'posts', slug: 'live', approve: true }) }),
      {
        params: Promise.resolve({ route: ['request'] }),
      },
    );
    expect(res.status).toBe(401);
    expect(row('posts', 'live')).toBeDefined();
  });

  it('accepts Markdown for rich text and returns it as Markdown when asked', async () => {
    const r = await call(TOKENS.writer, 'create_entry', { collection: 'posts', data: { title: 'Md post', content: '## Hello\n\nSome **bold** text.' } });
    expect(r.ok).toBe(true);
    const stored = row('posts', 'md-post')?.data as { content: { type: string; content: { type: string }[] } };
    expect(stored.content.type).toBe('doc');
    expect(stored.content.content.map((n) => n.type)).toEqual(['heading', 'paragraph']);

    const asJson = await call(TOKENS.reader, 'get_entry', { collection: 'posts', slug: 'md-post' });
    expect(asJson.entry.content.type).toBe('doc');
    const asMd = await call(TOKENS.reader, 'get_entry', { collection: 'posts', slug: 'md-post', richText: 'markdown' });
    expect(asMd.entry.content).toBe('## Hello\n\nSome **bold** text.');
    expect(asMd.lossy).toBeUndefined();
    const listed = await call(TOKENS.reader, 'list_entries', { collection: 'posts', fields: ['content'], richText: 'markdown' });
    expect(listed.entries.find((e: { slug: string }) => e.slug === 'md-post').entry).toEqual({ content: '## Hello\n\nSome **bold** text.' });

    const upd = await call(TOKENS.writer, 'update_entry', { collection: 'posts', slug: 'md-post', data: { content: 'New *text*' } });
    expect(upd.ok).toBe(true);
    expect((await call(TOKENS.reader, 'get_entry', { collection: 'posts', slug: 'md-post', richText: 'markdown' })).entry.content).toBe('New *text*');
  });

  it('refuses Markdown tables with a field error', async () => {
    const r = await call(TOKENS.writer, 'create_entry', { collection: 'posts', data: { title: 'T', content: '| a |\n|---|\n| 1 |' } });
    expect(r.isError).toBe(true);
    expect(r.errors.content).toContain('tables');
  });

  it('validates without saving', async () => {
    const r = await call(TOKENS.reader, 'validate_entry', { collection: 'posts', slug: 'live', data: { kind: 'opinion' } });
    expect(r.errors).toHaveProperty('kind');
    expect(row('posts', 'live')?.data).toMatchObject({ kind: 'news' });
  });

  it('gives a preview link', async () => {
    const r = await call(TOKENS.reader, 'get_preview_url', { collection: 'posts', slug: 'live' });
    expect(r).toMatchObject({ ok: true, url: 'http://x/api/mnml/preview/open?key=posts&slug=live', path: '/posts/live' });
  });
});
