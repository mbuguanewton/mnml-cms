import { describe, expect, it } from 'vite-plus/test';
import type { AssistantTurn } from './api.js';
import { chatTitle, groupTurns, parseTurns, pruneTurns } from './assistant-turns.js';

const turn = (chatId: string, minute: number, question = 'q', answer = 'a', extra: Partial<AssistantTurn> = {}): AssistantTurn => ({
  chatId,
  page: 'posts/a',
  at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  question,
  answer,
  status: 'done',
  ...extra,
});

describe('groupTurns', () => {
  it('puts the turns of a chat together in order, newest chat first', () => {
    const chats = groupTurns([turn('x', 5, 'x2', 'xa2'), turn('y', 9, 'y1', 'ya1'), turn('x', 1, 'x1', 'xa1')]);
    expect(chats.map((c) => c.id)).toEqual(['y', 'x']);
    expect(chats[1].messages.map((m) => m.text)).toEqual(['x1', 'xa1', 'x2', 'xa2']);
    expect(chats[1].title).toBe('x1');
  });

  it('carries which fields were filled and what was left out, but not the values', () => {
    const [chat] = groupTurns([
      turn('x', 1, 'q', 'a', { fills: [{ fields: ['title'], dropped: { category: 'no' }, before: { title: 'old' }, after: { title: 'new' } }] }),
    ]);
    expect(chat.messages[1].fills).toEqual([{ keys: ['title'], dropped: { category: 'no' } }]);
    expect(JSON.stringify(chat)).not.toContain('old');
  });

  it('says so when an answer did not finish', () => {
    const [chat] = groupTurns([turn('x', 1, 'q', '', { status: 'error' })]);
    expect(chat.messages[1].error).toBeTruthy();
  });
});

describe('pruneTurns', () => {
  const limits = { maxChats: 3, maxChars: 1000 };

  it('keeps everything under the limits', () => {
    const turns = [turn('a', 1), turn('b', 2)];
    expect(pruneTurns(turns, limits)).toEqual(turns);
  });

  it('drops the oldest chats first, whole', () => {
    const turns = [turn('a', 1), turn('a', 2), turn('b', 3), turn('c', 4), turn('d', 5)];
    const kept = pruneTurns(turns, limits);
    expect(new Set(kept.map((t) => t.chatId))).toEqual(new Set(['b', 'c', 'd']));
    expect(kept).toHaveLength(3);
  });

  it('drops old chats to stay under the size limit, but always keeps the newest', () => {
    const big = (id: string, m: number) => turn(id, m, 'q'.repeat(400), 'a'.repeat(400));
    expect(new Set(pruneTurns([big('a', 1), big('b', 2)], limits).map((t) => t.chatId))).toEqual(new Set(['b']));
    expect(pruneTurns([turn('only', 1, 'q'.repeat(5000))], limits)).toHaveLength(1);
  });

  it('counts a chat by when it last had an answer, not when it began', () => {
    const turns = [turn('old', 1), turn('new', 2), turn('old', 9)];
    expect(new Set(pruneTurns(turns, { maxChats: 1, maxChars: 1000 }).map((t) => t.chatId))).toEqual(new Set(['old']));
  });
});

describe('parseTurns', () => {
  it('skips what is not a turn and keeps only known fields', () => {
    const out = parseTurns([
      turn('a', 1),
      7,
      null,
      { chatId: 'x' },
      {
        ...turn('b', 2),
        status: 'weird',
        evil: 'x',
        fills: [{ fields: ['t'], dropped: {} }, 'bad'],
        tools: [{ name: 'get_entry', input: { a: 1 } }, { nope: 1 }],
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ chatId: 'b', status: 'done', fills: [{ fields: ['t'] }], tools: [{ name: 'get_entry', input: { a: 1 } }] });
    expect('evil' in out[1]).toBe(false);
    expect(parseTurns('nope')).toEqual([]);
  });
});

describe('chatTitle', () => {
  it('is one line, shortened, with a fallback', () => {
    expect(chatTitle('  What does\n the site   say? ')).toBe('What does the site say?');
    expect(chatTitle('a'.repeat(200)).length).toBeLessThanOrEqual(48);
    expect(chatTitle('')).toBe('Chat');
  });
});
