'use client';

import { useEffect, useRef, useState } from 'react';
import { BotIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import type { ActivityEvent } from '../../api.js';
import { Button } from '../ui/button.js';
import { useAdmin } from '../shell/context.js';
import { actionLabels, brief, groupByDay } from './activity-tree.js';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; events: ActivityEvent[] };

const time = (at: string) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** What an event holds beyond its first line: fields, the assistant's tools and fills. */
function Detail({ e }: { e: ActivityEvent }) {
  const a = e.assistant;
  return (
    <div className="mt-1.5 space-y-2 border-l border-mnml-line pl-3 text-xs text-mnml-text-soft">
      {e.for && <p>Asked by {e.for.label}</p>}
      {e.fields && e.fields.length > 0 && (
        <p>
          <span className="text-mnml-text-mute">Fields: </span>
          {e.fields.join(', ')}
        </p>
      )}
      {a && (
        <>
          <p>
            <span className="text-mnml-text-mute">Asked: </span>
            {a.question}
          </p>
          {a.model && (
            <p>
              <span className="text-mnml-text-mute">Model: </span>
              {a.model}
            </p>
          )}
          {a.status !== 'done' && <p>{a.status === 'stopped' ? 'Stopped before it finished' : 'Ended with an error'}</p>}
          {a.tools.length > 0 && (
            <div>
              <p className="text-mnml-text-mute">Tools it ran</p>
              <ul className="mt-0.5 space-y-0.5">
                {a.tools.map((t, i) => (
                  <li key={i} className="font-mono break-words">
                    {t.name}
                    {t.input !== undefined && <span className="text-mnml-text-mute"> {brief(t.input, 120)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.fills.map((f, i) => (
            <div key={i}>
              <p className="text-mnml-text-mute">Put in the form: {f.fields.join(', ')}</p>
              {f.before !== undefined && f.after !== undefined && (
                <ul className="mt-0.5 space-y-0.5">
                  {f.fields.map((name) => (
                    <li key={name} className="break-words">
                      <span className="font-medium text-mnml-text">{name}</span>: <span className="line-through opacity-70">{brief(f.before?.[name], 80)}</span>{' '}
                      → {brief(f.after?.[name], 80)}
                    </li>
                  ))}
                </ul>
              )}
              {Object.entries(f.dropped).map(([name, why]) => (
                <p key={name}>
                  Left out {name}: {why}
                </p>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Row({ e }: { e: ActivityEvent }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(e.fields?.length || e.assistant || e.for);
  const assistant = e.by.type === 'assistant';
  return (
    <li className="relative pb-3 pl-5 last:pb-0">
      <span
        className="absolute top-1.5 left-0 flex size-2.5 -translate-x-1/2 items-center justify-center rounded-full border border-mnml-text-mute bg-mnml-bg"
        aria-hidden
      />
      <button
        type="button"
        disabled={!hasDetail}
        aria-expanded={hasDetail ? open : undefined}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-1.5 rounded-[4px] text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary disabled:cursor-default"
      >
        {hasDetail ? (
          <ChevronRightIcon className={`mt-0.5 size-3.5 shrink-0 text-mnml-text-mute transition-transform ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-medium text-mnml-text">{actionLabels[e.action] ?? e.action}</span>
          {e.summary && <span className="text-mnml-text-soft"> · {e.summary}</span>}
          <span className="block text-xs text-mnml-text-mute">
            {assistant && <BotIcon className="mr-1 inline size-3 align-[-1px]" />}
            {e.by.label}
            {e.by.type === 'agent' && ' (agent)'}
            {' · '}
            <time dateTime={e.at}>{time(e.at)}</time>
          </span>
        </span>
      </button>
      {open && <Detail e={e} />}
    </li>
  );
}

/** The Activity of one entry or singleton: a tree of days, each with the events of that day, newest first. */
export function ActivityDialog({ schemaKey, slug, onClose }: { schemaKey: string; slug?: string; onClose: () => void }) {
  const { apiPath } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ key: schemaKey, ...(slug && { slug }) });
    fetch(`${apiPath}/activity?${q}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        setState(
          res.ok && Array.isArray(json.events)
            ? { kind: 'ready', events: json.events }
            : { kind: 'error', message: json.message ?? 'Could not load the activity.' },
        );
      })
      .catch((e) => !ctrl.signal.aborted && setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load the activity.' }));
    return () => ctrl.abort();
  }, [apiPath, schemaKey, slug]);

  const days = state.kind === 'ready' ? groupByDay(state.events) : [];

  return (
    <dialog
      ref={dialog}
      aria-labelledby="mnml-activity-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="max-h-[min(40rem,calc(100vh-2rem))] w-[min(30rem,calc(100vw-2rem))] rounded-[10px] border border-mnml-line bg-mnml-bg p-0 text-sm text-mnml-text shadow-xl backdrop:bg-black/40 [font-family:ui-sans-serif,system-ui,sans-serif]"
      style={{ margin: 'auto' }}
    >
      <div className="flex items-center justify-between border-b border-mnml-line px-4 py-3">
        <h2 id="mnml-activity-title" className="text-sm font-semibold">
          Activity
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="max-h-[min(34rem,calc(100vh-8rem))] overflow-y-auto px-4 py-3">
        {state.kind === 'loading' && <p className="text-mnml-text-mute">Loading…</p>}
        {state.kind === 'error' && <p className="text-mnml-danger">{state.message}</p>}
        {state.kind === 'ready' && days.length === 0 && (
          <p className="text-mnml-text-mute">Nothing yet. Saves, publishes and what the assistant does show up here.</p>
        )}
        <ol className="space-y-4">
          {days.map((d) => (
            <li key={d.label}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-mnml-text-mute uppercase">{d.label}</p>
              <ul className="ml-1 border-l border-mnml-line">
                {d.events.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}
