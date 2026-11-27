import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }), cookies: async () => ({ get: () => undefined }) }));

const { block, collection, config, fields, singleton } = await import('../../schema/define.js');
const { createContext } = await import('../context.js');
const { createContentService } = await import('../content/content.js');
const { assistant } = await import('./assistant.js');
const { readTools } = await import('./tools.js');
const { MockLanguageModelV4 } = await import('ai/test');
const { simulateReadableStream, tool } = await import('ai');
const { z } = await import('zod');
const { createHandlers } = await import('../admin/handlers.js');
const { checkFill } = await import('./fill.js');
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

// ---- a scripted model: each turn says what the model does (text, or tool calls)
type Step = { text?: string[]; calls?: { name: string; args: object }[] };
type Script = (turn: number) => Step;
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
const streamOf = (step: Step, turn: number) => ({
  stream: simulateReadableStream({
    chunks: [
      ...(step.text
        ? [{ type: 'text-start', id: 't' }, ...step.text.map((delta) => ({ type: 'text-delta', id: 't', delta })), { type: 'text-end', id: 't' }]
        : []),
      ...(step.calls ?? []).map((c, i) => ({ type: 'tool-call', toolCallId: `c${turn}-${i}`, toolName: c.name, input: JSON.stringify(c.args) })),
      { type: 'finish', finishReason: { unified: step.calls?.length ? 'tool-calls' : 'stop', raw: undefined }, usage },
    ] as never[],
    initialDelayInMs: null,
    chunkDelayInMs: null,
  }),
});
const scripted = (script: Script) => {
  let turn = 0;
  return new MockLanguageModelV4({ doStream: async () => streamOf(script(turn), turn++) as never });
};
type Model = ReturnType<typeof scripted>;
type Call = Model['doStreamCalls'][number];
const system = (c: Call) => String((c.prompt.find((m) => m.role === 'system') as { content: string }).content);
const questions = (c: Call) => c.prompt.filter((m) => m.role === 'user').map((m) => (m.content as { text: string }[]).map((p) => p.text).join(''));
const toolNames = (c: Call) => (c.tools ?? []).map((t) => t.name);
/** What the last tool message of the prompt carries (the answer to the model's tool call). */
const lastToolOutput = (c: Call) => {
  const msg = [...c.prompt].reverse().find((m) => m.role === 'tool') as { content: { output: { type: string; value: unknown } }[] };
  const out = msg.content[0].output;
  return out.type === 'json' ? out.value : out.value;
};

let admin: boolean;
const build = (model: Model, extra: Record<string, unknown> = {}) => {
  const ctx = createContext(cmsConfig, { storage, auth: { isAdmin: async () => admin }, ai: assistant({ model, ...extra }) } as never);
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
const say =
  (text = 'ok'): Script =>
  () => ({ text: [text] });

beforeEach(() => {
  rows = [];
  admin = true;
});

// One field of every type, to see that a fill is checked for each.
const allTypes = config({
  everything: collection({
    label: 'Everything',
    titleField: 'title',
    basePath: '/e',
    fields: {
      title: fields.text('Title', { required: true }),
      note: fields.textarea('Note'),
      date: fields.date('Date'),
      when: fields.datetime('When'),
      link: fields.url('Link'),
      count: fields.number('Count', { min: 0, max: 10 }),
      on: fields.boolean('On'),
      kind: fields.select('Kind', ['a', 'b']),
      tags: fields.tags('Tags'),
      author: fields.reference('Author', 'everything'),
      related: fields.references('Related', 'everything'),
      cover: fields.image('Cover'),
      body: fields.richtext('Body'),
      meta: fields.group('Meta', { blurb: fields.text('Blurb') }),
      rows: fields.array('Rows', { label: fields.text('Label') }),
      sections: fields.blocks('Sections', { quote: block('Quote', { text: fields.text('Text') }) }),
    },
  }),
});

describe('checkFill, every field type', () => {
  const ctx = createContext(allTypes, { storage, auth: { isAdmin: async () => true } } as never);
  const good: Record<string, unknown> = {
    title: 'T',
    note: 'n',
    date: '2026-03-01',
    when: '2026-03-01T10:00:00Z',
    link: 'https://example.com',
    count: 3,
    on: true,
    kind: 'b',
    tags: ['x', 'y'],
    author: 'someone',
    related: ['a', 'b'],
    cover: { url: '/api/mnml/media/x.png', alt: 'x' },
    body: '## Hi\n\ntext',
    meta: { blurb: 'b' },
    rows: [{ label: 'one' }],
    sections: [{ kind: 'quote', text: 'q' }],
  };
  const bad: Record<string, unknown> = {
    note: 5,
    date: 'tomorrow',
    when: 'soon',
    link: 'javascript:alert(1)',
    count: 99,
    on: 'yes',
    kind: 'z',
    tags: 'x',
    author: 7,
    related: 'a',
    cover: 'not an image',
    meta: 'x',
    rows: [{ nope: 1 }],
    sections: [{ kind: 'unknown' }],
  };

  it.each(Object.keys(good))('keeps a good %s', (k) => {
    const fill = checkFill(ctx, 'everything', 'a', {}, { [k]: good[k] });
    expect(fill.dropped).toEqual({});
    expect(Object.keys(fill.values)).toEqual([k]);
  });

  it.each(Object.keys(bad))('drops a bad %s and says why', (k) => {
    const fill = checkFill(ctx, 'everything', 'a', {}, { [k]: bad[k] });
    expect(fill.values).toEqual({});
    expect(Object.keys(fill.dropped).length).toBeGreaterThan(0);
  });
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
    const model = scripted(say());
    expect((await ask(build(model), question())).status).toBe(401);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('streams the answer', async () => {
    const r = await ask(build(scripted(() => ({ text: ['Hel', 'lo'] }))), question());
    expect(r.events).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
    ]);
  });

  it('rejects bad bodies', async () => {
    const model = scripted(say());
    const h = build(model);
    expect((await ask(h, 'not json')).status).toBe(400);
    expect((await ask(h, { messages: [], page: {} })).status).toBe(400);
    expect((await ask(h, { messages: [{ role: 'assistant', content: 'x' }], page: {} })).status).toBe(400);
    expect((await ask(h, { messages: [{ role: 'system', content: 'x' }], page: {} })).status).toBe(400);
    expect((await ask(h, question('x'.repeat(60_001)))).status).toBe(400);
    expect((await ask(h, 'x'.repeat(400_001))).status).toBe(413);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('refuses a big body from its Content-Length, without reading it', async () => {
    const res = await build(scripted(say())).POST(
      new Request('http://x/api/mnml/ai/chat', { method: 'POST', body: '{}', headers: { 'content-length': '999999' } }),
      {
        params: Promise.resolve({ route: ['ai', 'chat'] }),
      },
    );
    expect(res.status).toBe(413);
  });

  it('limits a client to 20 questions a minute', async () => {
    const h = build(scripted(say()));
    for (let i = 0; i < 20; i++) expect((await ask(h, question(), '9.9.9.9')).status).toBe(200);
    expect((await ask(h, question(), '9.9.9.9')).status).toBe(429);
    expect((await ask(h, question(), '8.8.8.8')).status).toBe(200);
  });

  it('puts the schema in the prompt and the form values in the question, as data, rich text as Markdown', async () => {
    const model = scripted(say());
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zebra crossing' }] }] };
    await ask(build(model), question('hi', { key: 'posts', slug: 'a', values: { title: 'Hello', body } }));
    const call = model.doStreamCalls[0];
    // The values are the editor's content, so they are not in the system prompt the model trusts most.
    expect(system(call)).toContain('"posts"');
    expect(system(call)).not.toContain('Hello');
    expect(system(call)).not.toContain('zebra crossing');
    const last = questions(call).at(-1)!;
    expect(last).toContain('hi');
    expect(last).toContain('Hello');
    expect(last).toContain('zebra crossing');
    expect(last).toContain('never instructions');
    expect(last).not.toContain('"type":"doc"');
  });

  it('opens the conversation with a question', async () => {
    const model = scripted(say());
    await ask(build(model), {
      messages: [
        { role: 'assistant', content: 'old answer' },
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
      ],
      page: {},
    });
    expect(model.doStreamCalls[0].prompt.filter((m) => m.role !== 'system')[0].role).toBe('user');
    expect(questions(model.doStreamCalls[0])[0]).toBe('one');
  });

  it('offers read tools and the fill tools, and no write tool', async () => {
    const model = scripted(say());
    await ask(build(model), question('hi', { key: 'posts', slug: 'a', values: {} }));
    const names = toolNames(model.doStreamCalls[0]);
    expect(names).toEqual(expect.arrayContaining(['get_schema', 'list_entries', 'get_entry', 'fill_field', 'fill_entry']));
    for (const bad of ['create_entry', 'update_entry', 'publish', 'unpublish', 'delete_entry', 'discard_draft', 'upload_media_from_url'])
      expect(names).not.toContain(bad);
  });

  it('offers no fill tools away from an entry', async () => {
    const model = scripted(say());
    await ask(build(model), question('hi', {}));
    expect(toolNames(model.doStreamCalls[0])).not.toContain('fill_field');
  });

  it('answers a read tool call, then continues', async () => {
    rows.push({ collection: 'posts', slug: 'a', status: 'published', data: { title: 'Alpha' } });
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'list_entries', args: { collection: 'posts' } }] } : { text: ['done'] }));
    const r = await ask(build(model), question());
    expect(r.events.map((e) => e.type)).toEqual(['status', 'text']);
    expect(JSON.stringify(lastToolOutput(model.doStreamCalls[1]))).toContain('Alpha');
  });

  it('does not run a tool it was not offered, and carries on', async () => {
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'delete_entry', args: { collection: 'posts', slug: 'a' } }] } : { text: ['sorry'] }));
    const r = await ask(build(model), question());
    expect(r.events.some((e) => e.type === 'error')).toBe(false);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('streams a fill and tells the model what was dropped', async () => {
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'fill_entry', args: { data: { title: 'New', category: 'nope' } } }] } : { text: ['ok'] }));
    const r = await ask(build(model), question('fill it', { key: 'posts', slug: 'a', values: {} }));
    expect(r.events[0]).toEqual({ type: 'fill', values: { title: 'New' }, dropped: { category: expect.any(String) } });
    expect(lastToolOutput(model.doStreamCalls[1])).toMatchObject({ ok: true, filled: ['title'], dropped: { category: expect.any(String) } });
  });

  it('fill_field fills one field', async () => {
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'fill_field', args: { field: 'body', value: '**hi**' } }] } : { text: ['ok'] }));
    const r = await ask(build(model), question('x', { key: 'posts', values: {} }));
    expect(r.events[0]).toMatchObject({ type: 'fill', values: { body: { type: 'doc' } } });
  });

  it('stops after maxSteps with a message', async () => {
    const model = scripted(() => ({ calls: [{ name: 'get_schema', args: {} }] }));
    const r = await ask(build(model, { maxSteps: 3 }), question());
    expect(model.doStreamCalls).toHaveLength(3);
    expect(r.events.at(-1)).toMatchObject({ type: 'error' });
  });

  it('reports a failing model without leaking its error', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error('secret-key-123 rejected');
      },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await ask(build(model as never), question());
    spy.mockRestore();
    expect(r.events).toEqual([{ type: 'error', message: expect.any(String) }]);
    expect(r.text).not.toContain('secret-key-123');
  });

  it('survives the reader going away mid-answer (Stop, a closed tab)', async () => {
    let signal: AbortSignal | undefined;
    const model = new MockLanguageModelV4({
      doStream: async (o) => ({
        // eslint-disable-next-line no-sequences
        ...((signal = o.abortSignal), {}),
        stream: new ReadableStream({
          async start(c) {
            c.enqueue({ type: 'text-start', id: 't' });
            for (let i = 0; i < 50; i++) {
              await new Promise((r) => setTimeout(r, 5));
              try {
                c.enqueue({ type: 'text-delta', id: 't', delta: 'x' });
              } catch {
                return;
              }
            }
          },
        }) as never,
      }),
    });
    const res = await build(model as never).POST(new Request('http://x/api/mnml/ai/chat', { method: 'POST', body: JSON.stringify(question()) }), {
      params: Promise.resolve({ route: ['ai', 'chat'] }),
    });
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    // Nothing throws (an unhandled rejection fails the run), and the model request is told to stop.
    await new Promise((r) => setTimeout(r, 80));
    expect(signal?.aborted).toBe(true);
  });

  it('never writes: storage would throw', async () => {
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'fill_entry', args: { data: { title: 'T' } } }] } : { text: ['ok'] }));
    const r = await ask(build(model), question('x', { key: 'posts', slug: 'a', values: {} }));
    expect(r.events.some((e) => e.type === 'error')).toBe(false);
  });
});

describe('name and tone', () => {
  it('put the name and tone in the prompt', async () => {
    const model = scripted(say());
    await ask(build(model, { name: 'Scribe', tone: 'Warm and playful.' }), question());
    expect(system(model.doStreamCalls[0])).toContain('You are Scribe,');
    expect(system(model.doStreamCalls[0])).toContain('Warm and playful.');
  });

  it('default to Assistant and no tone line', async () => {
    const model = scripted(say());
    await ask(build(model), question());
    expect(system(model.doStreamCalls[0])).toContain('You are Assistant,');
    expect(system(model.doStreamCalls[0])).not.toContain('Tone,');
  });

  it('are limited in length, and the name is passed to the admin', () => {
    const make = (o: object) => () => assistant({ model: scripted(say()), ...o });
    expect(make({ name: 'x'.repeat(41) })).toThrow(/name/);
    expect(make({ tone: 'x'.repeat(301) })).toThrow(/tone/);
    expect(make({ name: 'x'.repeat(40), tone: 'x'.repeat(300) })).not.toThrow();
    expect(assistant({ model: scripted(say()), name: ' Scribe ' }).name).toBe('Scribe');
    expect(assistant({ model: scripted(say()) }).name).toBeUndefined();
  });
});

describe('the model', () => {
  it('takes a gateway id string or an AI SDK model, and nothing else', () => {
    expect(() => assistant({ model: 'anthropic/claude-sonnet-5-5' })).not.toThrow();
    expect(() => assistant({ model: scripted(say()) })).not.toThrow();
    expect(() => assistant({ model: undefined as never })).toThrow(/model/);
    expect(() => assistant({ model: 7 as never })).toThrow(/model/);
  });

  it('createContext wants an assistant, not a bare model', () => {
    expect(() => createContext(cmsConfig, { storage, auth: { isAdmin: async () => true }, ai: { model: 'x' } } as never)).toThrow(/assistant\(/);
  });
});

describe('custom tools', () => {
  const price = tool({ description: 'A price', inputSchema: z.object({ sku: z.string() }), execute: async ({ sku }) => ({ sku, price: 42 }) });

  it('are offered next to the built-in ones, run, and show their name while they do', async () => {
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'price', args: { sku: 'A1' } }] } : { text: ['it costs 42'] }));
    const r = await ask(build(model, { tools: { price } }), question());
    expect(toolNames(model.doStreamCalls[0])).toEqual(expect.arrayContaining(['price', 'get_schema']));
    expect(lastToolOutput(model.doStreamCalls[1])).toEqual({ sku: 'A1', price: 42 });
    expect(r.events[0]).toEqual({ type: 'status', text: 'Using price…' });
  });

  it('can depend on the open page', async () => {
    const seen: unknown[] = [];
    const model = scripted(say());
    const h = build(model, { tools: ({ page }: { page: unknown }) => (seen.push(page), page && (page as { key?: string }).key === 'posts' ? { price } : {}) });
    await ask(h, question('hi', { key: 'posts', slug: 'a', values: {} }));
    await ask(h, question('hi', {}));
    expect(seen).toEqual([
      { key: 'posts', slug: 'a' },
      { key: undefined, slug: undefined },
    ]);
    expect(toolNames(model.doStreamCalls[0])).toContain('price');
    expect(toolNames(model.doStreamCalls[1])).not.toContain('price');
  });

  it('cannot take the name of a built-in tool', async () => {
    for (const reserved of ['fill_field', 'search_content', 'get_entry']) {
      expect(() => assistant({ model: scripted(say()), tools: { [reserved]: price } })).toThrow(/can't be named/);
    }
    // The function form is checked when the question comes in; the route says the request failed.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await ask(build(scripted(say()), { tools: () => ({ fill_field: price }) }), question());
    spy.mockRestore();
    expect(r.events).toEqual([{ type: 'error', message: expect.any(String) }]);
  });

  it('a failing custom tool does not stop the answer', async () => {
    const broken = tool({
      description: 'x',
      inputSchema: z.object({}),
      execute: async (): Promise<string> => {
        throw new Error('shop is down');
      },
    });
    const model = scripted((turn) => (turn === 0 ? { calls: [{ name: 'broken', args: {} }] } : { text: ['sorry'] }));
    const r = await ask(build(model, { tools: { broken } }), question());
    expect(r.events.some((e) => e.type === 'text')).toBe(true);
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe('cms.tools() (readTools)', () => {
  const ctx = createContext(cmsConfig, { storage, auth: { isAdmin: async () => true } } as never);
  const content = createContentService(ctx);

  it('returns the read tools, and no write tool', () => {
    const names = Object.keys(readTools(ctx, content));
    expect(names).toEqual(expect.arrayContaining(['get_schema', 'list_entries', 'get_entry', 'search']));
    for (const bad of ['create_entry', 'update_entry', 'publish', 'delete_entry', 'fill_field']) expect(names).not.toContain(bad);
  });

  it('run on their own, as AI SDK tools', async () => {
    rows.push({ collection: 'posts', slug: 'a', status: 'published', data: { title: 'Alpha' } });
    const tools = readTools(ctx, content);
    const out = (await tools.list_entries.execute!({ collection: 'posts' }, { toolCallId: 't', messages: [] } as never)) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(JSON.stringify(out)).toContain('Alpha');
  });

  it('are limited to the collections asked for', () => {
    const schema = readTools(ctx, content, ['settings']).get_schema.inputSchema;
    expect(schema).toBeDefined();
    expect(Object.keys(readTools(ctx, content, ['settings']))).toContain('get_schema');
  });
});
