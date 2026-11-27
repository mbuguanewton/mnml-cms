'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpIcon, PlusIcon, SparklesIcon, SquareIcon, Undo2Icon, XIcon } from 'lucide-react';
import { Button } from '../ui/button.js';
import { useAdmin } from '../shell/context.js';
import { useAssistant } from './assistant-context.js';
import { useAssistantChat, type ChatMessage } from './use-assistant-chat.js';

const PANEL_WIDTH = '26rem';
const ENTRY_STARTERS = ['Summarize this entry', 'Suggest a better title', 'Fill in the empty fields'];
const SITE_STARTERS = ['What does the site say about…?', 'Which entries are about…?'];

/** The FAB and the chat panel on the right. Mounted by the admin only when `ai` is set. */
export function Assistant({ name = 'Assistant' }: { name?: string }) {
  const { apiPath } = useAdmin();
  const a = useAssistant();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const fab = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const chat = useAssistantChat(apiPath, a?.target ?? { current: null });
  const [draft, setDraft] = useState('');

  // Focus the box on open, and give focus back to the FAB on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) fab.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // From small screens up the page makes room for the panel instead of sitting under it, so the header's Save and
  // Publish stay reachable. On a phone the panel covers the page.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia('(min-width: 640px)');
    const fit = () => document.body.style.setProperty('padding-right', wide.matches ? PANEL_WIDTH : '');
    fit();
    wide.addEventListener('change', fit);
    return () => {
      wide.removeEventListener('change', fit);
      document.body.style.removeProperty('padding-right');
    };
  }, [open]);

  // Keep the newest words in view.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  if (!a) return null;
  const starters = a.label ? ENTRY_STARTERS : SITE_STARTERS;

  const submit = (text = draft) => {
    if (!text.trim() || chat.busy) return;
    setDraft('');
    void chat.send(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      {!open && (
        <button
          ref={fab}
          type="button"
          aria-label={`Open ${name}`}
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
          className="mnml-state fixed right-4 bottom-4 z-40 flex size-12 cursor-pointer items-center justify-center rounded-full bg-mnml-primary text-mnml-on-primary shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary focus-visible:ring-offset-2 print:hidden [&_svg]:size-5"
        >
          <SparklesIcon aria-hidden />
        </button>
      )}
      <aside
        id={panelId}
        aria-label={name}
        hidden={!open}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="mnml-root fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-mnml-line bg-mnml-bg text-sm text-mnml-text shadow-xl [font-family:ui-sans-serif,system-ui,sans-serif] sm:w-[26rem] print:hidden"
      >
        <header className="flex items-center gap-2 border-b border-mnml-line px-4 py-3">
          <SparklesIcon aria-hidden className="size-4 text-mnml-text-mute" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">{name}</h2>
            <p className="truncate text-xs text-mnml-text-mute">{a.label ? `Looking at ${a.label}` : 'Looking at the whole site'}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Close ${name}`} onClick={() => setOpen(false)}>
            <XIcon aria-hidden />
          </Button>
        </header>

        <div ref={log} role="log" aria-live="polite" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {chat.messages.length === 0 ? (
            <div className="flex flex-col gap-3 text-mnml-text-soft">
              <p>
                Ask about your content, or ask me to write it.{' '}
                {a.label
                  ? 'What I write goes into the form as an unsaved edit, so you can review it. Nothing is published.'
                  : 'Open an entry to have me fill it in.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="mnml-state cursor-pointer rounded-full border border-mnml-line px-3 py-1 text-xs text-mnml-text-soft hover:bg-mnml-surface"
                    onClick={() => (s.endsWith('…?') ? (setDraft(s.replace('…?', ' ')), input.current?.focus()) : submit(s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.messages.map((m) => <Message key={m.id} m={m} busy={chat.busy} onUndo={(fillId) => chat.undo(m.id, fillId)} />)
          )}
        </div>

        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col rounded-[22px] border border-mnml-line bg-mnml-panel shadow-sm transition-colors focus-within:border-mnml-primary">
            <textarea
              ref={input}
              value={draft}
              rows={3}
              aria-label={`Message ${name}`}
              placeholder="Ask or write something…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              className="max-h-48 min-h-20 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none placeholder:text-mnml-text-mute"
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
              <button
                type="button"
                disabled={chat.messages.length === 0}
                onClick={chat.clear}
                className="mnml-state flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-mnml-line bg-mnml-bg px-3.5 text-xs text-mnml-text shadow-sm outline-none hover:bg-mnml-surface focus-visible:ring-2 focus-visible:ring-mnml-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
              >
                <PlusIcon aria-hidden />
                New chat
              </button>
              {chat.busy ? (
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={chat.stop}
                  className="mnml-state flex size-9 cursor-pointer items-center justify-center rounded-full bg-mnml-primary text-mnml-on-primary outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary focus-visible:ring-offset-2 [&_svg]:size-3.5 [&_svg]:fill-current"
                >
                  <SquareIcon aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!draft.trim()}
                  className="mnml-state flex size-9 cursor-pointer items-center justify-center rounded-full bg-mnml-primary text-mnml-on-primary outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
                >
                  <ArrowUpIcon aria-hidden />
                </button>
              )}
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}

function Message({ m, busy, onUndo }: { m: ChatMessage; busy: boolean; onUndo: (fillId: number) => void }) {
  if (m.role === 'user') {
    return <p className="ml-8 self-end rounded-[8px] bg-mnml-surface px-3 py-2 whitespace-pre-wrap">{m.text}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
      {m.status && <p className="text-xs text-mnml-text-mute">{m.status}</p>}
      {!m.text && !m.status && !m.error && busy && m.fills.length === 0 && <p className="text-xs text-mnml-text-mute">Thinking…</p>}
      {m.fills.map((f) => (
        <div key={f.id} className="flex flex-col gap-1 rounded-[6px] border border-mnml-line px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1">
              {f.undone ? 'Put back' : 'Filled'}: <span className="font-medium">{f.keys.join(', ')}</span>
              {!f.undone && <span className="text-mnml-text-mute"> (unsaved in the form)</span>}
            </p>
            {!f.undone && (
              <Button variant="ghost" size="sm" onClick={() => onUndo(f.id)}>
                <Undo2Icon aria-hidden />
                Undo
              </Button>
            )}
          </div>
          {Object.keys(f.dropped).length > 0 && (
            <p className="text-mnml-text-mute">
              Left out:{' '}
              {Object.entries(f.dropped)
                .map(([k, why]) => `${k} (${why})`)
                .join('; ')}
            </p>
          )}
        </div>
      ))}
      {m.error && (
        <p role="alert" className="text-xs text-mnml-danger">
          {m.error}
        </p>
      )}
    </div>
  );
}
