import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { collection, config, fields, singleton } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createHandlers } = await import('../admin/handlers.js');
const { checkFill } = await import('./fill.js');
type AiEvent = import('./types.js').AiEvent;
type AiRequest = import('./types.js').AiRequest;
type EntryStorage = import('../content/storage.js').EntryStorage;

const cmsConfig = config({
  settings: singleton({ label: 'Settings', preview: '/', fields: { tagline: fields.text('Tagline') } }),
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    fields: {
      title: fields.text('Title', { required: true }),
      category: fields.select('Category', ['news', 'guide']),
      body: fields.richtext('Body'),
    },
  }),
});

type Row = { collection: string; slug: string; data: unknown; status: string };
let rows: Row[];
const storage: EntryStorage = {
  readRow: async (c, s) => rows.find((r) => r.collection === c && r.slug === s),
  readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() })),
  upsert: async () => {
    throw new Error('the assistant must never write');
  },
  insertIfAbsent: async () => {
    throw new Error('the assistant must never write');
  },
  remove: async () => {
    throw new Error('the assistant must never write');
  },
};

type Script = (request: AiRequest, turn: number) => AiEvent[];
let requests: AiRequest[];
const model = (script: Script) => ({
  stream: async function* (request: AiRequest) {
    requests.push(request);
    for (const e of script(request, requests.length - 1)) yield e;
  },
});

let admin: boolean;
const build = (script: Script, maxSteps?: number, extra: { name?: string; tone?: string } = {}) => {
  const ctx = createContext(cmsConfig, { storage, auth: { isAdmin: async () => admin }, ai: { model: model(script), maxSteps, ...extra } } as never);
  return createHandlers(ctx);
};

const ask = async (handlers: ReturnType<typeof build>, body: unknown, ip = '1.1.1.1') => {
  const res = await handlers.POST(
    new Request('http://x/api/mnml/ai/chat', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'x-forwarded-for': ip },
    }),
    { params: Promise.resolve({ route: ['ai', 'chat'] }) },
  );
  const text = await res.text();
  const events =
    res.status === 200
      ? text
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : [];
  return { status: res.status, events, text };
};

const question = (content = 'hi', page: object = {}) => ({ messages: [{ role: 'user', content }], page });

beforeEach(() => {
  rows = [];
  requests = [];
  admin = true;
});

describe('checkFill', () => {
  const ctx = createContext(cmsConfig, { storage, auth: { isAdmin: async () => true } } as never);

  it('keeps valid fields, converts Markdown, and drops the rest with a reason', () => {
    const fill = checkFill(ctx, 'posts', 'a', { title: 'Old' }, { title: 'New', category: 'nope', body: '# Hello\n\nworld', bogus: 1 });
    expect(Object.keys(fill.values).sort()).toEqual(['body', 'title']);
    expect(fill.values.title).toBe('New');
    expect(fill.values.body).toMatchObject({ type: 'doc' });
    expect(Object.keys(fill.dropped).sort()).toEqual(['bogus', 'category']);
  });

  it('does not blame a field for problems elsewhere in the form', () => {
    // `title` is required and still empty, but the category on its own is fine.
    const fill = checkFill(ctx, 'posts', undefined, {}, { category: 'guide' });
    expect(fill.values).toEqual({ category: 'guide' });
    expect(fill.dropped).toEqual({});
  });

  it('refuses a non-object', () => {
    expect(checkFill(ctx, 'posts', 'a', {}, 'x')).toEqual({ values: {}, dropped: { $data: 'Expected an object of fields.' } });
  });
});

describe('ai/chat route', () => {
  it('is a 404 when `ai` is off', async () => {
    const ctx = createContext(cmsConfig, { storage, auth: { isAdmin: async () => true } } as never);
    const res = await createHandlers(ctx).POST(new Request('http://x/api/mnml/ai/chat', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ route: ['ai', 'chat'] }),
    });
    expect(res.status).toBe(404);
  });

  it('is for admins only, and never reaches the model otherwise', async () => {
    admin = false;
    const h = build(() => [{ type: 'text', text: 'x' }]);
    expect((await ask(h, question())).status).toBe(401);
    expect(requests).toHaveLength(0);
  });

  it('streams the answer', async () => {
    const h = build(() => [
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
    ]);
    const r = await ask(h, question());
    expect(r.events).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
    ]);
  });

  it('rejects bad bodies', async () => {
    const h = build(() => []);
    expect((await ask(h, 'not json')).status).toBe(400);
    expect((await ask(h, { messages: [], page: {} })).status).toBe(400);
    expect((await ask(h, { messages: [{ role: 'assistant', content: 'x' }], page: {} })).status).toBe(400);
    expect((await ask(h, { messages: [{ role: 'system', content: 'x' }], page: {} })).status).toBe(400);
    expect((await ask(h, question('x'.repeat(60_001)))).status).toBe(400);
    expect((await ask(h, 'x'.repeat(400_001))).status).toBe(413);
    expect(requests).toHaveLength(0);
  });

  it('limits a client to 20 questions a minute', async () => {
    const h = build(() => []);
    for (let i = 0; i < 20; i++) expect((await ask(h, question(), '9.9.9.9')).status).toBe(200);
    expect((await ask(h, question(), '9.9.9.9')).status).toBe(429);
    expect((await ask(h, question(), '8.8.8.8')).status).toBe(200);
  });

  it('puts the open page in the prompt, rich text as Markdown', async () => {
    const h = build(() => []);
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zebra crossing' }] }] };
    await ask(h, question('hi', { key: 'posts', slug: 'a', values: { title: 'Hello', body } }));
    const system = requests[0].system;
    expect(system).toContain('"posts"');
    expect(system).toContain('Hello');
    expect(system).toContain('zebra crossing');
    expect(system).not.toContain('"type":"doc"');
  });

  it('offers read tools and the fill tools, and no write tool', async () => {
    const h = build(() => []);
    await ask(h, question('hi', { key: 'posts', slug: 'a', values: {} }));
    const names = requests[0].tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['get_schema', 'list_entries', 'get_entry', 'fill_field', 'fill_entry']));
    for (const bad of ['create_entry', 'update_entry', 'publish', 'unpublish', 'delete_entry', 'discard_draft', 'upload_media_from_url'])
      expect(names).not.toContain(bad);
  });

  it('offers no fill tools away from an entry', async () => {
    const h = build(() => []);
    await ask(h, question('hi', {}));
    expect(requests[0].tools.map((t) => t.name)).not.toContain('fill_field');
  });

  it('answers a read tool call, then continues', async () => {
    rows.push({ collection: 'posts', slug: 'a', status: 'published', data: { title: 'Alpha' } });
    const h = build((_, turn) =>
      turn === 0 ? [{ type: 'tool_call', id: 'c1', name: 'list_entries', args: { collection: 'posts' } }] : [{ type: 'text', text: 'done' }],
    );
    const r = await ask(h, question());
    expect(r.events.map((e) => e.type)).toEqual(['status', 'text']);
    const tool = requests[1].messages.at(-1);
    expect(tool).toMatchObject({ role: 'tool', id: 'c1', name: 'list_entries' });
    expect((tool as { content: string }).content).toContain('Alpha');
  });

  it('refuses a tool the model was not offered', async () => {
    const h = build((_, turn) => (turn === 0 ? [{ type: 'tool_call', id: 'c1', name: 'delete_entry', args: { collection: 'posts', slug: 'a' } }] : []));
    await ask(h, question());
    expect((requests[1].messages.at(-1) as { content: string }).content).toContain('Unknown tool');
  });

  it('streams a fill and tells the model what was dropped', async () => {
    const h = build((_, turn) =>
      turn === 0 ? [{ type: 'tool_call', id: 'c1', name: 'fill_entry', args: { data: { title: 'New', category: 'nope' } } }] : [{ type: 'text', text: 'ok' }],
    );
    const r = await ask(h, question('fill it', { key: 'posts', slug: 'a', values: {} }));
    expect(r.events[0]).toEqual({ type: 'fill', values: { title: 'New' }, dropped: { category: expect.any(String) } });
    const result = JSON.parse((requests[1].messages.at(-1) as { content: string }).content);
    expect(result).toMatchObject({ ok: true, filled: ['title'], dropped: { category: expect.any(String) } });
  });

  it('fill_field fills one field', async () => {
    const h = build((_, turn) => (turn === 0 ? [{ type: 'tool_call', id: 'c1', name: 'fill_field', args: { field: 'body', value: '**hi**' } }] : []));
    const r = await ask(h, question('x', { key: 'posts', values: {} }));
    expect(r.events[0]).toMatchObject({ type: 'fill', values: { body: { type: 'doc' } } });
  });

  it('stops after maxSteps with a message', async () => {
    const h = build(() => [{ type: 'tool_call', id: 'c', name: 'get_schema', args: {} }], 3);
    const r = await ask(h, question());
    expect(requests).toHaveLength(3);
    expect(r.events.at(-1)).toMatchObject({ type: 'error' });
  });

  it('reports a failing model without leaking its error', async () => {
    const ctx = createContext(cmsConfig, {
      storage,
      auth: { isAdmin: async () => true },
      ai: {
        model: {
          // eslint-disable-next-line require-yield
          stream: async function* () {
            throw new Error('secret-key-123 rejected');
          },
        },
      },
    } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await ask(createHandlers(ctx), question());
    spy.mockRestore();
    expect(r.events).toEqual([{ type: 'error', message: expect.any(String) }]);
    expect(r.text).not.toContain('secret-key-123');
  });

  it('never writes: storage would throw', async () => {
    const h = build((_, turn) => (turn === 0 ? [{ type: 'tool_call', id: 'c1', name: 'fill_entry', args: { data: { title: 'T' } } }] : []));
    const r = await ask(h, question('x', { key: 'posts', slug: 'a', values: {} }));
    expect(r.events.some((e: { type: string }) => e.type === 'error')).toBe(false);
  });
});

describe('name and tone', () => {
  it('put the name and tone in the prompt', async () => {
    await ask(
      build(() => [], undefined, { name: 'Scribe', tone: 'Warm and playful.' }),
      question(),
    );
    expect(requests[0].system).toContain('You are Scribe,');
    expect(requests[0].system).toContain('Warm and playful.');
  });

  it('default to Assistant and no tone line', async () => {
    await ask(
      build(() => []),
      question(),
    );
    expect(requests[0].system).toContain('You are Assistant,');
    expect(requests[0].system).not.toContain('Tone,');
  });

  it('are limited in length', () => {
    const make = (ai: object) => () =>
      createContext(cmsConfig, { storage, auth: { isAdmin: async () => true }, ai: { model: model(() => []), ...ai } } as never);
    expect(make({ name: 'x'.repeat(41) })).toThrow(/name/);
    expect(make({ tone: 'x'.repeat(301) })).toThrow(/tone/);
    expect(make({ name: 'x'.repeat(40), tone: 'x'.repeat(300) })).not.toThrow();
  });
});

describe('createContext', () => {
  it('needs a model with stream()', () => {
    expect(() => createContext(cmsConfig, { storage, auth: { isAdmin: async () => true }, ai: { model: {} } } as never)).toThrow(/stream/);
  });
});
