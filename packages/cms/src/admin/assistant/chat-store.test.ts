import { describe, expect, it } from 'vite-plus/test';
import { chatTitle, MAX_CHARS, MAX_CHATS, readChats, upsertChat, writeChats, type SavedChat } from './chat-store.js';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};
const chat = (id: string, at: number, text = 'hello'): SavedChat => ({
  id,
  title: chatTitle([{ role: 'user', text }]),
  updatedAt: at,
  messages: [{ role: 'user', text }],
});

describe('chat store', () => {
  it('keeps the chats of one page apart from another', () => {
    const s = memory();
    writeChats(s, 'posts/a', [chat('1', 1)]);
    writeChats(s, 'posts/b', [chat('2', 2)]);
    expect(readChats(s, 'posts/a').map((c) => c.id)).toEqual(['1']);
    expect(readChats(s, 'posts/b').map((c) => c.id)).toEqual(['2']);
    expect(readChats(s, 'posts/c')).toEqual([]);
  });

  it('returns the newest first', () => {
    const s = memory();
    writeChats(s, 'p', upsertChat(upsertChat([], chat('old', 1)), chat('new', 9)));
    expect(readChats(s, 'p').map((c) => c.id)).toEqual(['new', 'old']);
  });

  it('replaces a chat with the same id instead of adding another', () => {
    const list = upsertChat(upsertChat([], chat('a', 1, 'first')), chat('a', 2, 'second'));
    expect(list).toHaveLength(1);
    expect(list[0].messages[0].text).toBe('second');
  });

  it('keeps at most MAX_CHATS, dropping the oldest', () => {
    let list: SavedChat[] = [];
    for (let i = 0; i < MAX_CHATS + 5; i++) list = upsertChat(list, chat(String(i), i));
    expect(list).toHaveLength(MAX_CHATS);
    expect(list.at(-1)!.id).toBe('5');
    expect(list[0].id).toBe(String(MAX_CHATS + 4));
  });

  it('stays under the size limit, but always keeps the newest chat', () => {
    const big = (id: string, at: number) => chat(id, at, 'x'.repeat(MAX_CHARS / 2 + 1));
    const list = upsertChat(upsertChat([], big('a', 1)), big('b', 2));
    expect(list.map((c) => c.id)).toEqual(['b']);
    expect(upsertChat([], big('only', 1)).map((c) => c.id)).toEqual(['only']);
  });

  it('removes the entry when the list is empty', () => {
    const s = memory();
    writeChats(s, 'p', [chat('1', 1)]);
    writeChats(s, 'p', []);
    expect(s.data.size).toBe(0);
  });

  it('survives corrupt or foreign data', () => {
    const s = memory();
    for (const raw of ['not json', '{}', '[1,"x",null]', '[{"id":"a"}]', '[{"id":"a","title":"t","messages":[{"role":"system","text":"x"}]}]']) {
      s.setItem('mnml-assistant:p', raw);
      expect(readChats(s, 'p')).toEqual([]);
    }
    expect(readChats(null, 'p')).toEqual([]);
  });

  it('drops messages that are not messages and keeps the rest', () => {
    const s = memory();
    s.setItem(
      'mnml-assistant:p',
      JSON.stringify([
        {
          id: 'a',
          title: 't',
          updatedAt: 1,
          messages: [
            { role: 'user', text: 'hi' },
            { role: 'x', text: 'no' },
            7,
            { role: 'assistant', text: 'yo', fills: [{ keys: ['title'], dropped: { a: 'b' } }, 'bad'] },
          ],
        },
      ]),
    );
    expect(readChats(s, 'p')[0].messages).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'yo', fills: [{ keys: ['title'], dropped: { a: 'b' } }] },
    ]);
  });

  it('does not throw when storage is full or blocked', () => {
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => writeChats(full, 'p', [chat('1', 1)])).not.toThrow();
    expect(() => writeChats(full, 'p', [])).not.toThrow();
    expect(() => writeChats(null, 'p', [chat('1', 1)])).not.toThrow();
  });
});

describe('chatTitle', () => {
  it('is the first question, on one line and shortened', () => {
    expect(
      chatTitle([
        { role: 'assistant', text: 'x' },
        { role: 'user', text: '  What does\n the site   say? ' },
      ]),
    ).toBe('What does the site say?');
    const t = chatTitle([{ role: 'user', text: 'a'.repeat(200) }]);
    expect(t.length).toBeLessThanOrEqual(48);
    expect(t.endsWith('…')).toBe(true);
  });

  it('has a fallback', () => {
    expect(chatTitle([])).toBe('Chat');
  });
});
