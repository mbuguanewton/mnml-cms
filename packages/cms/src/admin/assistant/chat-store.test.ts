import { describe, expect, it } from 'vite-plus/test';
import type { AssistantTurn } from '../../api.js';
import { groupTurns } from '../../assistant-turns.js';
import { appendTurn, MAX_CHARS, MAX_CHATS, parseStored, rawTurns, removeChat } from './chat-store.js';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};
const turn = (chatId: string, minute: number, question = 'hello', answer = 'hi'): AssistantTurn => ({
  chatId,
  page: 'p',
  at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  question,
  answer,
  status: 'done',
});
const chats = (s: ReturnType<typeof memory>, page: string) => groupTurns(parseStored(rawTurns(s, page)));

describe('browser store', () => {
  it('keeps the turns of one page apart from another', () => {
    const s = memory();
    appendTurn(s, 'posts/a', turn('1', 1));
    appendTurn(s, 'posts/b', turn('2', 2));
    expect(chats(s, 'posts/a').map((c) => c.id)).toEqual(['1']);
    expect(chats(s, 'posts/b').map((c) => c.id)).toEqual(['2']);
    expect(chats(s, 'posts/c')).toEqual([]);
  });

  it('adds the turns of a chat to that chat', () => {
    const s = memory();
    appendTurn(s, 'p', turn('1', 1, 'first'));
    appendTurn(s, 'p', turn('1', 2, 'second'));
    const [chat] = chats(s, 'p');
    expect(chat.messages.map((m) => m.text)).toEqual(['first', 'hi', 'second', 'hi']);
  });

  it('drops the oldest chats past MAX_CHATS, whole', () => {
    const s = memory();
    for (let i = 0; i < MAX_CHATS + 3; i++) appendTurn(s, 'p', turn(`c${i}`, i));
    const ids = chats(s, 'p').map((c) => c.id);
    expect(ids).toHaveLength(MAX_CHATS);
    expect(ids).not.toContain('c0');
    expect(ids).toContain(`c${MAX_CHATS + 2}`);
  });

  it('stays under the size limit, but keeps the newest chat', () => {
    const s = memory();
    const big = 'x'.repeat(MAX_CHARS / 2 + 1);
    appendTurn(s, 'p', turn('a', 1, big));
    appendTurn(s, 'p', turn('b', 2, big));
    expect(chats(s, 'p').map((c) => c.id)).toEqual(['b']);
  });

  it('removes a chat with all its turns, and the entry when none are left', () => {
    const s = memory();
    appendTurn(s, 'p', turn('1', 1));
    appendTurn(s, 'p', turn('1', 2));
    appendTurn(s, 'p', turn('2', 3));
    removeChat(s, 'p', '1');
    expect(chats(s, 'p').map((c) => c.id)).toEqual(['2']);
    removeChat(s, 'p', '2');
    expect(s.data.size).toBe(0);
  });

  it('survives corrupt or foreign data', () => {
    const s = memory();
    for (const raw of ['not json', '{}', '[1,"x",null]', '[{"chatId":"a"}]']) {
      s.setItem('mnml-assistant-turns:p', raw);
      expect(parseStored(rawTurns(s, 'p'))).toEqual([]);
    }
    expect(parseStored(rawTurns(null, 'p'))).toEqual([]);
  });

  it('does not throw when storage is full or blocked', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => appendTurn(full, 'p', turn('1', 1))).not.toThrow();
    expect(() => removeChat(full, 'p', '1')).not.toThrow();
    expect(() => appendTurn(null, 'p', turn('1', 1))).not.toThrow();
  });
});
