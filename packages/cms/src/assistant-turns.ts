import type { AssistantTurn } from './api.js';

// Helpers for the assistant's record of turns. No React, no server code: the panel (browser), the browser store and a
// site's own store all use them.

export type SavedMessage = {
  role: 'user' | 'assistant';
  text: string;
  error?: string;
  /** Fields the assistant filled during this answer. Undo needs the form as it was, so it is not kept. */
  fills?: { keys: string[]; dropped: Record<string, string> }[];
};

/** A chat put back together from its turns. */
export type SavedChat = { id: string; title: string; updatedAt: number; messages: SavedMessage[] };

const TITLE = 48;

/** The first question, shortened: what a chat is called in the list. */
export function chatTitle(question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  return q.length > TITLE ? `${q.slice(0, TITLE - 1).trimEnd()}…` : q || 'Chat';
}

const time = (t: AssistantTurn) => Date.parse(t.at) || 0;

/** Turns grouped into chats, newest chat first; a chat's messages are its questions and answers in order. */
export function groupTurns(turns: AssistantTurn[]): SavedChat[] {
  const byChat = new Map<string, AssistantTurn[]>();
  for (const t of turns) byChat.set(t.chatId, [...(byChat.get(t.chatId) ?? []), t]);
  return [...byChat.entries()]
    .map(([id, list]): SavedChat => {
      const sorted = [...list].sort((a, b) => time(a) - time(b));
      return {
        id,
        title: chatTitle(sorted[0].question),
        updatedAt: time(sorted[sorted.length - 1]),
        messages: sorted.flatMap((t): SavedMessage[] => [
          { role: 'user', text: t.question },
          {
            role: 'assistant',
            text: t.answer,
            ...(t.status === 'error' && !t.answer && { error: 'That answer did not finish.' }),
            ...(t.fills?.length && { fills: t.fills.map((f) => ({ keys: f.fields, dropped: f.dropped })) }),
          },
        ]),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const size = (t: AssistantTurn) => t.question.length + t.answer.length;

/**
 * The turns that are kept: the newest chats, at most `maxChats` and `maxChars` in all. Whole chats go, oldest first;
 * the newest chat is always kept. The turns come back in the order they came.
 */
export function pruneTurns(turns: AssistantTurn[], { maxChats, maxChars }: { maxChats: number; maxChars: number }): AssistantTurn[] {
  const newest = new Map<string, number>();
  const chars = new Map<string, number>();
  for (const t of turns) {
    newest.set(t.chatId, Math.max(newest.get(t.chatId) ?? 0, time(t)));
    chars.set(t.chatId, (chars.get(t.chatId) ?? 0) + size(t));
  }
  const keep = new Set<string>();
  let total = 0;
  for (const [id] of [...newest.entries()].sort((a, b) => b[1] - a[1])) {
    total += chars.get(id) ?? 0;
    if (keep.size > 0 && (keep.size >= maxChats || total > maxChars)) break;
    keep.add(id);
  }
  return turns.filter((t) => keep.has(t.chatId));
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);

/** Turns from storage or a site's store, checked: anything that isn't a turn is skipped, and only known fields are kept. */
export function parseTurns(value: unknown): AssistantTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): AssistantTurn[] => {
    const t = obj(raw);
    if (!t) return [];
    const { chatId, page, at, question, answer, status } = t;
    if (typeof chatId !== 'string' || typeof page !== 'string' || typeof at !== 'string' || typeof question !== 'string' || typeof answer !== 'string')
      return [];
    const fills = Array.isArray(t.fills)
      ? t.fills.flatMap((f) => {
          const o = obj(f);
          return o && Array.isArray(o.fields)
            ? [{ fields: o.fields.map(String), dropped: (obj(o.dropped) as Record<string, string>) ?? {}, before: obj(o.before), after: obj(o.after) }]
            : [];
        })
      : undefined;
    const usage = obj(t.usage);
    return [
      {
        chatId,
        page,
        at,
        question,
        answer,
        status: status === 'stopped' || status === 'error' ? status : 'done',
        ...(fills && { fills }),
        ...(Array.isArray(t.tools) && {
          tools: t.tools.flatMap((x) => (obj(x) && typeof obj(x)!.name === 'string' ? [{ name: obj(x)!.name as string, input: obj(x)!.input }] : [])),
        }),
        ...(str(t.model) && { model: str(t.model) }),
        ...(usage && { usage: { inputTokens: Number(usage.inputTokens) || undefined, outputTokens: Number(usage.outputTokens) || undefined } }),
        ...(typeof t.durationMs === 'number' && { durationMs: t.durationMs }),
      },
    ];
  });
}
