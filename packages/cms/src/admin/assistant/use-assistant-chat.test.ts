import { describe, expect, it } from 'vite-plus/test';
import { readEvents, recent } from './use-assistant-chat.js';

const stream = (chunks: string[]) => {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const x of chunks) c.enqueue(enc.encode(x));
      c.close();
    },
  });
};

describe('readEvents', () => {
  it('reads one event per line, whatever the chunking', async () => {
    const line = (o: object) => `${JSON.stringify(o)}\n`;
    const all = line({ type: 'text', text: 'héllo' }) + line({ type: 'status', text: 'x' }) + line({ type: 'error', message: 'm' });
    const out: unknown[] = [];
    // Split mid-line and mid-character.
    const bytes = new TextEncoder().encode(all);
    const mid = all.indexOf('é') + 1;
    const enc = new TextEncoder();
    await readEvents(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes.slice(0, enc.encode(all.slice(0, mid)).length - 1));
          c.enqueue(bytes.slice(enc.encode(all.slice(0, mid)).length - 1));
          c.close();
        },
      }),
      (e) => out.push(e),
    );
    expect(out).toEqual([
      { type: 'text', text: 'héllo' },
      { type: 'status', text: 'x' },
      { type: 'error', message: 'm' },
    ]);
  });

  it('skips a broken line and a missing final newline', async () => {
    const out: unknown[] = [];
    await readEvents(stream(['{"type":"text","text":"a"}\nnot json\n{"type":"text","text":"b"}']), (e) => out.push(e));
    expect(out).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ]);
  });
});

describe('recent', () => {
  const chat = (n: number) => Array.from({ length: n }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content: `m${i}` }));

  it('keeps a short conversation as it is', () => {
    expect(recent(chat(5))).toEqual(chat(5));
  });

  it('opens with a question and ends with the new one, however long the chat', () => {
    for (const n of [19, 20, 21, 22, 41, 42]) {
      const out = recent(chat(n % 2 === 0 ? n + 1 : n));
      expect(out[0].role).toBe('user');
      expect(out.at(-1)!.role).toBe('user');
      expect(out.length).toBeLessThanOrEqual(20);
    }
  });

  it('stays under the character limit, keeping the newest', () => {
    const long = 'x'.repeat(20_000);
    const all = [
      { role: 'user' as const, content: long },
      { role: 'assistant' as const, content: long },
      { role: 'user' as const, content: long },
      { role: 'assistant' as const, content: long },
      { role: 'user' as const, content: 'now' },
    ];
    const out = recent(all);
    expect(out.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(50_000);
    expect(out.at(-1)!.content).toBe('now');
    expect(out[0].role).toBe('user');
  });
});
