'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AssistantEvent, AssistantTurn } from '../../api.js';
import { groupTurns, parseTurns } from '../../assistant-turns.js';
import type { AssistantTarget } from './assistant-context.js';
import { appendTurn, browserStore, parseStored, rawTurns, removeChat, subscribeChats } from './chat-store.js';

/** What happened to the form during an answer: the fields that were filled (and can be undone) and those left out. */
export type FillNote = {
  id: number;
  keys: string[];
  dropped: Record<string, string>;
  undone: boolean;
  /** What the fields held before, for Undo. Missing on a chat opened from the history: the form has moved on. */
  before?: Record<string, unknown>;
};

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant is doing while it works, e.g. "Searching the content…". */
  status?: string;
  fills: FillNote[];
  error?: string;
};

/** Most earlier messages, and characters, sent along with a question. The server refuses more than 30 messages or 60,000 characters. */
const HISTORY = 20;
const HISTORY_CHARS = 50_000;
/** The longest question the panel sends: the server takes 60,000 characters in all, with the history before it. */
const MAX_QUESTION = 30_000;

/**
 * The newest messages that fit, starting with a question: a model API refuses a conversation that opens with an
 * answer, and the newest message is always the question being asked.
 */
export function recent<M extends { role: 'user' | 'assistant'; content: string }>(all: M[]): M[] {
  let chars = 0;
  const out: M[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < HISTORY; i--) {
    chars += all[i].content.length;
    if (chars > HISTORY_CHARS && out.length > 0) break;
    out.unshift(all[i]);
  }
  while (out.length > 1 && out[0].role === 'assistant') out.shift();
  return out;
}

/** Reads a stream of JSON lines, calling `onEvent` for each complete one. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: AssistantEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as AssistantEvent);
    } catch {
      // A broken line is skipped; the rest of the answer still arrives.
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(flush);
  }
  flush(buffer + decoder.decode());
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** A page's turns from the site's store, through the server; null when they can't be had (the list stays as it was). */
async function fetchTurns(apiPath: string, pageId: string): Promise<AssistantTurn[] | null> {
  try {
    const res = await fetch(`${apiPath}/ai/chats?page=${encodeURIComponent(pageId)}`);
    const json = await res.json();
    return json.ok ? parseTurns(json.turns) : null;
  } catch {
    return null;
  }
}

/** Where the earlier chats come from: the browser (the default), or the site's own store through the server. */
export type HistorySource = 'browser' | 'server';

/**
 * The conversation with the assistant. `pageId` names the page it is on: its earlier chats are kept under that id, and
 * only that page's chats are listed. A different page needs a different hook state: key the component that calls
 * this by `pageId`.
 *
 * Every finished answer is a turn. With the `browser` history the turn is kept here (words only); with `server` the
 * server records it in the site's store and the list is fetched from there.
 */
export function useAssistantChat(apiPath: string, target: { current: AssistantTarget | null }, pageId: string, history: HistorySource = 'browser') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState(newId);
  // The chat a question is asked in, read when it is sent.
  const chat = useRef(chatId);
  const abort = useRef<AbortController | null>(null);
  const next = useRef(1);

  // The earlier chats of this page. The browser's record comes from storage (nothing on the server, so the first client
  // render matches the HTML and they appear right after); the site's store is fetched.
  const raw = useSyncExternalStore(
    subscribeChats,
    () => (history === 'browser' ? rawTurns(browserStore(), pageId) : ''),
    () => '',
  );
  const [served, setServed] = useState<AssistantTurn[]>([]);
  /**
   * The server records a turn after the response, so it may not be in the store yet: look again, a few times, until
   * the turn (`chat`, `question`) is there.
   */
  const loadServed = useCallback(
    async (turn?: { chat: string; question: string }) => {
      if (history !== 'server') return;
      for (const wait of [0, 700, 1500, 3000, 5000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        const turns = await fetchTurns(apiPath, pageId);
        if (turns) setServed(turns);
        if (!turn || turns?.some((t) => t.chatId === turn.chat && t.question === turn.question)) return;
      }
    },
    [apiPath, pageId, history],
  );
  useEffect(() => {
    if (history !== 'server') return;
    let current = true;
    void fetchTurns(apiPath, pageId).then((turns) => current && turns && setServed(turns));
    return () => {
      current = false;
    };
  }, [apiPath, pageId, history]);
  const chats = useMemo(() => groupTurns(history === 'browser' ? parseStored(raw) : served), [history, raw, served]);

  const log = useRef<ChatMessage[]>([]);
  useEffect(() => {
    log.current = messages;
  }, [messages]);

  const patch = useCallback((id: number, change: (m: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.id === id ? change(m) : m))), []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || abort.current) return;
      if (text.length > MAX_QUESTION) {
        const id = next.current++;
        setMessages((all) => [
          ...all,
          {
            id,
            role: 'assistant',
            text: '',
            fills: [],
            error: `That question is too long (${text.length.toLocaleString()} characters). Keep it under ${MAX_QUESTION.toLocaleString()}.`,
          },
        ]);
        return;
      }
      const t = target.current;
      const thisChat = chat.current;
      const asked = recent(
        [...log.current, { id: 0, role: 'user' as const, text, fills: [] }].filter((m) => m.text).map((m) => ({ role: m.role, content: m.text })),
      );
      const userId = next.current++;
      const replyId = next.current++;
      setMessages((all) => [...all, { id: userId, role: 'user', text, fills: [] }, { id: replyId, role: 'assistant', text: '', fills: [] }]);
      const controller = (abort.current = new AbortController());
      setBusy(true);

      // What the turn will be, filled in as the answer comes.
      let answer = '';
      let status: AssistantTurn['status'] = 'done';
      const fills: { fields: string[]; dropped: Record<string, string> }[] = [];
      const fail = (error: string) => {
        status = 'error';
        patch(replyId, (m) => ({ ...m, error, status: undefined }));
      };
      try {
        const res = await fetch(`${apiPath}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: asked, chatId: thisChat, page: t ? { key: t.key, slug: t.slug, values: t.values } : {} }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          fail(json.message ?? json.error ?? `The request failed (${res.status}).`);
          return;
        }
        await readEvents(res.body, (e) => {
          if (e.type === 'text') {
            answer += e.text;
            patch(replyId, (m) => ({ ...m, text: m.text + e.text, status: undefined }));
          } else if (e.type === 'status') patch(replyId, (m) => ({ ...m, status: e.text }));
          else if (e.type === 'error') fail(e.message);
          else if (e.type === 'fill') {
            const form = target.current;
            if (!form) return;
            const before = form.apply(e.values);
            fills.push({ fields: Object.keys(e.values), dropped: e.dropped });
            patch(replyId, (m) => ({
              ...m,
              status: undefined,
              fills: [...m.fills, { id: next.current++, keys: Object.keys(e.values), dropped: e.dropped, undone: false, before }],
            }));
          }
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') status = 'stopped';
        else fail('Could not reach the server.');
      } finally {
        patch(replyId, (m) => ({ ...m, status: undefined }));
        // A newer question may have started since (after New chat): only release what this send holds.
        if (abort.current === controller) {
          abort.current = null;
          setBusy(false);
        }
        // A turn that got nowhere (a refused request, nothing answered) is not worth keeping.
        if (answer || fills.length) {
          if (history === 'browser') {
            appendTurn(browserStore(), pageId, {
              chatId: thisChat,
              page: pageId,
              at: new Date().toISOString(),
              question: text,
              answer,
              status,
              ...(fills.length && { fills }),
            });
          } else {
            void loadServed({ chat: thisChat, question: text });
          }
        }
      }
    },
    [apiPath, target, patch, history, pageId, loadServed],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const startChat = useCallback((id: string) => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    chat.current = id;
    setChatId(id);
  }, []);

  /** A new, empty chat. The one before stays in the history. */
  const clear = useCallback(() => {
    startChat(newId());
    setMessages([]);
  }, [startChat]);

  /** Opens an earlier chat of this page, to read and to carry on in. */
  const open = useCallback(
    (id: string) => {
      const found = chats.find((c) => c.id === id);
      if (!found) return;
      startChat(found.id);
      setMessages(
        found.messages.map((m) => ({
          id: next.current++,
          role: m.role,
          text: m.text,
          error: m.error,
          fills: (m.fills ?? []).map((f) => ({ id: next.current++, keys: f.keys, dropped: f.dropped, undone: false })),
        })),
      );
    },
    [chats, startChat],
  );

  /** Deletes an earlier chat from the browser's record. The site's store is an audit record: no delete there. */
  const remove = useCallback(
    (id: string) => {
      if (history !== 'browser') return;
      removeChat(browserStore(), pageId, id);
      if (id === chat.current) clear();
    },
    [history, pageId, clear],
  );

  // Closing the page (or the panel's page changing) stops the model request.
  useEffect(() => () => abort.current?.abort(), []);

  /** Puts a filled field back to what it was. Only works while the same form is open. */
  const undo = useCallback(
    (messageId: number, fillId: number) => {
      const form = target.current;
      const fill = log.current.find((m) => m.id === messageId)?.fills.find((f) => f.id === fillId);
      if (!form || !fill || fill.undone || !fill.before) return false;
      form.apply(fill.before);
      patch(messageId, (m) => ({ ...m, fills: m.fills.map((f) => (f.id === fillId ? { ...f, undone: true } : f)) }));
      return true;
    },
    [target, patch],
  );

  return { messages, busy, chats, chatId, canDelete: history === 'browser', send, stop, clear, open, remove, undo };
}
