'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AssistantEvent } from '../../api.js';
import type { AssistantTarget } from './assistant-context.js';
import { browserStore, chatTitle, parseChats, rawChats, readChats, subscribeChats, upsertChat, writeChats, type SavedMessage } from './chat-store.js';

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

/** What is kept of a chat: the words, and which fields were filled. */
const toSaved = (messages: ChatMessage[]): SavedMessage[] =>
  messages
    .filter((m) => m.text || m.error || m.fills.length)
    .map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.error && { error: m.error }),
      ...(m.fills.length && { fills: m.fills.map((f) => ({ keys: f.keys, dropped: f.dropped })) }),
    }));

/**
 * The conversation with the assistant. `pageId` names the page it is on: its earlier chats are kept in the browser
 * under that id, and only that page's chats are listed. A different page needs a different hook state: key the
 * component that calls this by `pageId`.
 */
export function useAssistantChat(apiPath: string, target: { current: AssistantTarget | null }, pageId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  // The earlier chats of this page, read from the browser's storage. Nothing on the server, so the first client render
  // matches the HTML and they appear right after.
  const raw = useSyncExternalStore(
    subscribeChats,
    () => rawChats(browserStore(), pageId),
    () => '',
  );
  const chats = useMemo(() => parseChats(raw), [raw]);
  const [chatId, setChatId] = useState(newId);
  const abort = useRef<AbortController | null>(null);
  const next = useRef(1);
  // A chat just opened from the history is not saved again (that would move it to the top for nothing).
  const opened = useRef(false);
  const history = useRef<ChatMessage[]>([]);
  useEffect(() => {
    history.current = messages;
  }, [messages]);

  // Keep the chat when an answer is finished (not on every word of it).
  useEffect(() => {
    if (busy || messages.length === 0) return;
    if (opened.current) {
      opened.current = false;
      return;
    }
    const saved = toSaved(messages);
    if (saved.length === 0) return;
    const store = browserStore();
    const list = upsertChat(readChats(store, pageId), { id: chatId, title: chatTitle(saved), updatedAt: Date.now(), messages: saved });
    writeChats(store, pageId, list);
  }, [messages, busy, chatId, pageId]);

  const patch = useCallback((id: number, change: (m: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.id === id ? change(m) : m))), []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || abort.current) return;
      const t = target.current;
      const asked = recent(
        [...history.current, { id: 0, role: 'user' as const, text, fills: [] }].filter((m) => m.text).map((m) => ({ role: m.role, content: m.text })),
      );
      const userId = next.current++;
      const replyId = next.current++;
      setMessages((all) => [...all, { id: userId, role: 'user', text, fills: [] }, { id: replyId, role: 'assistant', text: '', fills: [] }]);
      const controller = (abort.current = new AbortController());
      setBusy(true);
      const fail = (error: string) => patch(replyId, (m) => ({ ...m, error, status: undefined }));
      try {
        const res = await fetch(`${apiPath}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: asked, page: t ? { key: t.key, slug: t.slug, values: t.values } : {} }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          fail(json.message ?? json.error ?? `The request failed (${res.status}).`);
          return;
        }
        await readEvents(res.body, (e) => {
          if (e.type === 'text') patch(replyId, (m) => ({ ...m, text: m.text + e.text, status: undefined }));
          else if (e.type === 'status') patch(replyId, (m) => ({ ...m, status: e.text }));
          else if (e.type === 'error') fail(e.message);
          else if (e.type === 'fill') {
            const form = target.current;
            if (!form) return;
            const before = form.apply(e.values);
            patch(replyId, (m) => ({
              ...m,
              status: undefined,
              fills: [...m.fills, { id: next.current++, keys: Object.keys(e.values), dropped: e.dropped, undone: false, before }],
            }));
          }
        });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') fail('Could not reach the server.');
      } finally {
        patch(replyId, (m) => ({ ...m, status: undefined }));
        // A newer question may have started since (after New chat): only release what this send holds.
        if (abort.current === controller) {
          abort.current = null;
          setBusy(false);
        }
      }
    },
    [apiPath, target, patch],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  /** A new, empty chat. The one before stays in the history. */
  const clear = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setMessages([]);
    setChatId(newId());
  }, []);

  /** Opens an earlier chat of this page. */
  const open = useCallback(
    (id: string) => {
      const chat = readChats(browserStore(), pageId).find((c) => c.id === id);
      if (!chat) return;
      abort.current?.abort();
      abort.current = null;
      setBusy(false);
      opened.current = true;
      setChatId(chat.id);
      setMessages(
        chat.messages.map((m) => ({
          id: next.current++,
          role: m.role,
          text: m.text,
          error: m.error,
          fills: (m.fills ?? []).map((f) => ({ id: next.current++, keys: f.keys, dropped: f.dropped, undone: false })),
        })),
      );
    },
    [pageId],
  );

  /** Deletes an earlier chat. Deleting the open one starts a new one. */
  const remove = useCallback(
    (id: string) => {
      const store = browserStore();
      const list = readChats(store, pageId).filter((c) => c.id !== id);
      writeChats(store, pageId, list);
      if (id === chatId) clear();
    },
    [pageId, chatId, clear],
  );

  // Closing the page (or the panel's page changing) stops the model request.
  useEffect(() => () => abort.current?.abort(), []);

  /** Puts a filled field back to what it was. Only works while the same form is open. */
  const undo = useCallback(
    (messageId: number, fillId: number) => {
      const form = target.current;
      const fill = history.current.find((m) => m.id === messageId)?.fills.find((f) => f.id === fillId);
      if (!form || !fill || fill.undone || !fill.before) return false;
      form.apply(fill.before);
      patch(messageId, (m) => ({ ...m, fills: m.fills.map((f) => (f.id === fillId ? { ...f, undone: true } : f)) }));
      return true;
    },
    [target, patch],
  );

  return { messages, busy, chats, chatId, send, stop, clear, open, remove, undo };
}
