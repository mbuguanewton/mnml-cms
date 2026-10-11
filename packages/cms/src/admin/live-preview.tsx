'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLinkIcon, LoaderCircleIcon, RotateCwIcon, XIcon } from 'lucide-react';
import type { EntryInput, PreviewResult } from '../api.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';

const DEBOUNCE_MS = 500;

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'paused'; message: string };

/**
 * The public page in an iframe, kept in sync with the form. Each change is stored as a draft
 * (with Draft Mode on), then the frame reloads at the same scroll position.
 */
export function LivePreview({ input, onClose }: { input: EntryInput; onClose: () => void }) {
  const { post } = useAdmin();
  const frame = useRef<HTMLIFrameElement>(null);
  const scrollY = useRef(0);
  const seq = useRef(0);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const key = JSON.stringify(input);

  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(
      async () => {
        setStatus({ kind: 'loading' });
        const r = await post<PreviewResult>('preview', JSON.parse(key));
        if (id !== seq.current) return; // a newer edit is already on its way
        if (!r.ok) {
          // The form only highlights errors on Save, so name the first problem here.
          const [path, msg] = Object.entries(r.errors)[0] ?? [];
          return setStatus({ kind: 'paused', message: path ? `${path.replace('$', '')}: ${msg}` : r.message });
        }
        const win = frame.current?.contentWindow;
        if (url === r.url && win) {
          scrollY.current = win.scrollY;
          win.location.reload();
        } else {
          scrollY.current = 0;
          setUrl(r.url);
        }
      },
      // Show the first render straight away; debounce the rest.
      url === null ? 0 : DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
    // `url` is read for the current value only; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onLoad = () => {
    frame.current?.contentWindow?.scrollTo(0, scrollY.current);
    setStatus((s) => (s.kind === 'loading' ? { kind: 'ready' } : s));
  };

  return (
    <aside className="flex min-h-0 flex-1 flex-col border-l border-cms-line bg-cms-panel">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-cms-line px-3">
        <span className="min-w-0 flex-1 truncate [font-family:ui-monospace,monospace] text-xs text-cms-text-soft">{url ?? 'Preview'}</span>
        {status.kind === 'loading' && <LoaderCircleIcon className="size-3.5 animate-spin text-cms-text-mute" aria-label="Updating" />}
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Reload" title="Reload" disabled={!url} onClick={() => frame.current?.contentWindow?.location.reload()}>
          <RotateCwIcon />
        </Button>
        {url && (
          <a href={url} target="_blank" aria-label="Open in new tab" title="Open in new tab" className="cms-state flex size-6 items-center justify-center rounded-[6px] text-cms-text-soft">
            <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Close preview" title="Close preview" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {status.kind === 'paused' && (
        <p role="status" className="border-b border-cms-line bg-cms-warn px-3 py-1.5 text-xs text-cms-on-warn">
          Preview paused: {status.message}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        {url ? (
          <iframe ref={frame} src={url} title="Live preview" onLoad={onLoad} className="absolute inset-0 size-full bg-cms-bg" />
        ) : (
          <p className="p-6 text-center text-cms-text-mute">{status.kind === 'paused' ? 'Fill in the required fields to see the page.' : 'Loading preview…'}</p>
        )}
      </div>
    </aside>
  );
}
