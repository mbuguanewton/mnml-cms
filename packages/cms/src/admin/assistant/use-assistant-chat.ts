'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantEvent } from '../../api.js';
import type { AssistantTarget } from './assistant-context.js';

/** What happened to the form during an answer: the fields that were filled (and can be undone) and those left out. */
export type FillNote = { id: number; keys: string[]; dropped: Record<string, string>; undone: boolean; before: Record<string, unknown> };

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant is doing while it works, e.g. "Searching the content…". */
  status?: string;
  fills: FillNote[];
  error?: string;
};

/** Most earlier messages sent along with a question. */
const HISTORY = 20;

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

export function useAssistantChat(apiPath: string, target: { current: AssistantTarget | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const next = useRef(1);
  const history = useRef<ChatMessage[]>([]);
  useEffect(() => {
    history.current = messages;
  }, [messages]);

  const patch = useCallback((id: number, change: (m: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.id === id ? change(m) : m))), []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || abort.current) return;
      const t = target.current;
      const asked = [...history.current, { id: 0, role: 'user' as const, text, fills: [] }]
        .filter((m) => m.text)
        .slice(-HISTORY)
        .map((m) => ({ role: m.role, content: m.text }));
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
        abort.current = null;
        setBusy(false);
      }
    },
    [apiPath, target, patch],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const clear = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
  }, []);

  /** Puts a filled field back to what it was. Only works while the same form is open. */
  const undo = useCallback(
    (messageId: number, fillId: number) => {
      const form = target.current;
      const fill = history.current.find((m) => m.id === messageId)?.fills.find((f) => f.id === fillId);
      if (!form || !fill || fill.undone) return false;
      form.apply(fill.before);
      patch(messageId, (m) => ({ ...m, fills: m.fills.map((f) => (f.id === fillId ? { ...f, undone: true } : f)) }));
      return true;
    },
    [target, patch],
  );

  return { messages, busy, send, stop, clear, undo };
}
