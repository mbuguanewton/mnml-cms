'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon, XIcon } from 'lucide-react';
import type { ReferenceSchemaResult, SaveAction, SaveResult } from '../../api.js';
import { slugify, type Collection } from '../../schema/define.js';
import { displayText } from '../../schema/text.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { PortalHost } from '../ui/context.js';
import { labelClass } from '../ui/styles.js';
import { useAdmin } from '../shell/context.js';
import { StatusDot } from './status-dot.js';
import { FieldRenderer, RefOptionsProvider, type Errors, type RefOptions } from './fields.js';

/** An entry made from the panel, as a picker lists it. A draft is labelled as one until it's published. */
export type CreatedRef = { slug: string; label: string };

/** Picker label of an entry made from the panel. */
export const createdLabel = (title: string, draft: boolean) => (draft ? `${title} (draft)` : title);

type Loaded = Extract<ReferenceSchemaResult, { ok: true }>;

/**
 * "Create new" for a reference field: opens a panel docked on the right with the target collection's form, so an entry
 * can be made (and published) without leaving the one being edited. `onCreated` picks it in the field.
 */
export function CreateReference({ collection, label, onCreated }: { collection: string; label: string; onCreated: (ref: CreatedRef) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full justify-center border-dashed border-mnml-line! text-mnml-text-soft hover:text-mnml-text"
        onClick={() => setOpen(true)}
      >
        <PlusIcon /> Create new
        <span className="sr-only"> {label}</span>
      </Button>
      {open && (
        <ReferencePanel
          collection={collection}
          onClose={() => setOpen(false)}
          onCreated={(ref) => {
            setOpen(false);
            onCreated(ref);
          }}
        />
      )}
    </>
  );
}

function ReferencePanel({ collection, onClose, onCreated }: { collection: string; onClose: () => void; onCreated: (ref: CreatedRef) => void }) {
  const { post, confirm, toast } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);
  // The page's own form uses the same field paths for its ids, so these need a prefix of their own.
  const uid = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [baseline, setBaseline] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<SaveAction | null>(null);
  // No document on the server.
  const client = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    let live = true;
    void post<ReferenceSchemaResult>('reference/schema', { collection }).then((r) => {
      if (!live) return;
      if (!r.ok) return setFailed(r.message);
      setLoaded(r);
      setData(r.initial);
      setBaseline(JSON.stringify([r.initial, '']));
    });
    return () => {
      live = false;
    };
  }, [post, collection]);

  useEffect(() => {
    if (client && !dialog.current?.open) dialog.current?.showModal();
  }, [client]);

  const def: Collection | null = loaded?.schema ?? null;
  const dirty = JSON.stringify([data, slug]) !== baseline;

  const close = async () => {
    if (busy) return;
    if (dirty && !(await confirm({ title: 'Discard this entry?', description: 'What you entered here is not saved.', confirmLabel: 'Discard', danger: true })))
      return;
    dialog.current?.close();
    onClose();
  };

  const set = (key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    // The slug follows the title until it's edited by hand, like a new entry.
    if (def && key === def.titleField && !slugEdited) setSlug(slugify(String(value)));
  };

  const save = async (action: SaveAction) => {
    if (!def || busy) return;
    setBusy(action);
    setMessage(null);
    try {
      const r = await post<SaveResult>('save', { key: collection, slug, mode: 'create', data, action });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      const title = displayText(data[def.titleField]) || slug;
      toast({ title: action === 'publish' ? `“${title}” published` : `“${title}” saved as a draft`, tone: 'success' });
      dialog.current?.close();
      onCreated({ slug, label: createdLabel(title, action === 'draft') });
    } finally {
      setBusy(null);
    }
  };

  if (!client) return null;

  const title = def ? displayText(data[def.titleField]) : '';

  return createPortal(
    <dialog
      ref={dialog}
      aria-label={def ? `New entry in ${def.label}` : 'New entry'}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      onClick={(e) => e.target === e.currentTarget && void close()}
      // Escape closes only this panel, not a fullscreen editor or another panel under it.
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      className="mnml-root mnml-panel fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(36rem,100vw)] max-w-none border-l border-mnml-line bg-mnml-bg p-0 text-sm text-mnml-text shadow-2xl backdrop:bg-black/30 [font-family:ui-sans-serif,system-ui,sans-serif]"
    >
      <PortalHost>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-6 pt-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-mnml-panel px-3 py-1 text-xs font-medium text-mnml-text-soft">
              <StatusDot state="draft" className="size-2" /> New draft
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={() => void close()}>
              <XIcon />
            </Button>
          </div>
          <div className="flex flex-col gap-1 px-6 pb-4 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-mnml-text-mute">{def?.label ?? ''}</p>
            <h2 className={`truncate text-2xl font-semibold leading-tight [font-family:inherit] ${title ? '' : 'text-mnml-text-mute'}`}>
              {title || 'Untitled'}
            </h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t border-mnml-line px-6 py-6">
            {failed && <p className="text-mnml-danger">{failed}</p>}
            {!def && !failed && <p className="text-mnml-text-mute">Loading…</p>}
            {def && loaded && (
              <RefOptionsProvider value={loaded.refOptions as RefOptions}>
                {Object.entries(def.fields).map(([k, f]) => (
                  <div key={k} className="contents">
                    <FieldRenderer
                      field={f}
                      value={data[k]}
                      onChange={(v) => set(k, v)}
                      path={`${uid}.${k}`}
                      errors={Object.fromEntries(Object.entries(errors).map(([k, m]) => [`${uid}.${k}`, m]))}
                      siblings={data}
                    />
                    {k === def.titleField && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`${uid}-slug`} className={labelClass}>
                          Slug
                        </label>
                        <p className="-mt-1 text-mnml-text-mute">Used in the URL. Filled in from the title.</p>
                        <Input
                          id={`${uid}-slug`}
                          className="[font-family:ui-monospace,monospace] text-xs"
                          invalid={!!errors.$slug}
                          value={slug}
                          onChange={(v) => {
                            setSlugEdited(true);
                            setSlug(v);
                          }}
                        />
                        {errors.$slug && <p className="text-mnml-danger">{errors.$slug}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </RefOptionsProvider>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-mnml-line bg-mnml-panel px-6 py-3">
            {message && (
              <p role="alert" className="text-mnml-danger">
                {message}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void close()}>
                Cancel
              </Button>
              <div className="flex gap-2">
                {def && (
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void save('draft')}>
                    {busy === 'draft' ? 'Saving…' : 'Save draft'}
                  </Button>
                )}
                <Button type="button" disabled={!def || busy !== null} onClick={() => void save('publish')}>
                  {busy === 'publish' ? 'Publishing…' : 'Publish'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PortalHost>
    </dialog>,
    document.body,
  );
}
