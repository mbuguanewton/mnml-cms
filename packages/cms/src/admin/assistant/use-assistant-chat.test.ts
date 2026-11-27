import { describe, expect, it } from 'vite-plus/test';
import { readEvents } from './use-assistant-chat.js';

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
