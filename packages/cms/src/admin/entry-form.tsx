'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, FileXIcon } from 'lucide-react';
import { slugify, type Collection, type Fields, type Singleton } from '../define.js';
import type { EntryInput, EntryStatus, SaveAction, SaveResult } from '../api.js';
import { ActionMenu, MenuItem } from './action-menu.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { FieldRenderer, RefOptionsProvider, type RefOptions } from './fields.js';
import { LivePreview } from './live-preview.js';
import { AdminHeader, type Crumb } from './header.js';
import { StatusDot } from './status-dot.js';
import { bodyClass, inputClass, labelClass } from './styles.js';

type Props = {
  schemaKey: string;
  /** The singleton or collection definition (plain data, passed from the server). */
  schema: Singleton | Collection;
  initial: Record<string, unknown>;
  /** Collections only. Absent on create; locked once the entry exists. */
  slug?: string;
  notice?: string;
  crumbs: Crumb[];
  /** Collections only: the saved status of an existing entry. */
  status?: EntryStatus;
  /** Collections only: the entry is published and has saved changes that aren't live yet. */
  hasPending?: boolean;
  /** Read-only derived values (already formatted), shown after the field named in `after`, else at the end. */
  derived?: { key: string; label: string; after?: string; value: string }[];
  /** Entries the `reference` fields can pick from, by collection key. */
  refOptions?: RefOptions;
  /** Extra items for the header's "more" menu (use MenuItem / menuItemClass). */
  actions?: React.ReactNode;
};

export function EntryForm({ schemaKey, schema: def, initial, slug: existingSlug, notice, crumbs, status: savedStatus, hasPending = false, derived = [], refOptions = {}, actions }: Props) {
  const { post } = useAdmin();
  const router = useRouter();
  const fields: Fields = def.fields;
  const mode: 'create' | 'update' = def.kind === 'collection' && !existingSlug ? 'create' : 'update';
  const isCollection = def.kind === 'collection';
  const [status, setStatus] = useState<EntryStatus>(savedStatus ?? 'draft');
  const [changes, setChanges] = useState(hasPending);
  const [data, setData] = useState(initial);
  const [slug, setSlug] = useState(existingSlug ?? '');
  const [slugEdited, setSlugEdited] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(notice ? { ok: true, message: notice } : null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? result.errors : {};

  // Like Sanity's field groups: an "All fields" tab, plus one tab per `group` field that shows only
  // that group. Fields outside any group are under "General". No tab bar without a group.
  const groupKeys = Object.entries(fields).filter(([, f]) => f.type === 'group').map(([k]) => k);
  const hasLoose = Object.values(fields).some((f) => f.type !== 'group');
  const tabs = groupKeys.length === 0 ? [] : [
    { id: ALL, label: 'All fields' },
    ...(hasLoose ? [{ id: GENERAL, label: 'General' }] : []),
    ...groupKeys.map((k) => ({ id: k, label: fields[k].label })),
  ];
  const [tab, setTab] = useState(ALL);
  // The tab an error lives in, so a hidden one can be flagged and opened.
  const tabOf = (errorPath: string) => {
    const top = errorPath.split('.')[0];
    return groupKeys.includes(top) ? top : GENERAL;
  };
  const errorTabs = new Set(Object.keys(errors).map(tabOf));
  const inTab = (key: string) => tab === ALL || (fields[key].type === 'group' ? tab === key : tab === GENERAL);

  const set = (key: string, value: unknown) => {
    setData((d) => ({ ...d, [key]: value }));
    // Derive the slug from the title until the editor types their own.
    if (mode === 'create' && def.kind === 'collection' && key === def.titleField && !slugEdited) setSlug(slugify(String(value)));
  };

  // Dirty = differs from what was last loaded or saved. Save stays disabled until then.
  const snapshot = () => JSON.stringify([data, slug]);
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot() !== baseline;

  const input = (): EntryInput => ({ key: schemaKey, slug: def.kind === 'collection' ? slug : undefined, mode, data });
  const canPreview = def.preview !== undefined && def.preview !== false;
  const [previewHidden, setPreviewHidden] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const showPreview = canPreview && wide && !previewHidden;

  const published = mode === 'update' && status === 'published';
  // Singletons only ever save (publish). Collections: Save draft keeps it off the site (or, on a published
  // entry, keeps the edits pending); Publish makes the form the live version; Unpublish takes it down.
  const save = (action: SaveAction) => {
    const sent = snapshot();
    startTransition(async () => {
      const r = await post<SaveResult>('save', { ...input(), action: isCollection ? action : undefined });
      if (r.ok && r.redirect) {
        router.push(r.redirect);
        return;
      }
      setResult(r);
      if (!r.ok && tab !== ALL) {
        // Don't leave the editor on a tab that hides the problem.
        const bad = Object.keys(r.errors).map(tabOf);
        if (!bad.includes(tab)) setTab(bad[0] ?? ALL);
      }
      if (r.ok) {
        setBaseline(sent);
        if (action === 'publish') {
          setStatus('published');
          setChanges(false);
        } else if (action === 'unpublish') {
          setStatus('draft');
          setChanges(false);
        } else if (published) setChanges(true);
        router.refresh();
      }
    });
  };
  const dotState = status === 'draft' ? 'draft' : changes ? 'changes' : 'published';
  // Publish appears once there is something to publish; a saved draft can always be published.
  const showPublish = isCollection && (!published || dirty || changes);
  const canPublish = dirty || changes || (mode === 'update' && status === 'draft');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (showPublish ? canPublish : dirty) save(showPublish || !isCollection ? 'publish' : 'draft');
  };

  const slugField = def.kind === 'collection' && (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="f-slug" className={labelClass}>
        Slug
      </label>
      <p className="-mt-1 text-mnml-text-mute">{mode === 'update' ? 'The URL is fixed once an entry is created.' : 'Used in the URL. Filled in from the title.'}</p>
      <input
        id="f-slug"
        className={`${inputClass} [font-family:ui-monospace,monospace] text-xs read-only:bg-mnml-panel read-only:text-mnml-text-soft`}
        aria-invalid={!!errors.$slug}
        value={slug}
        readOnly={mode === 'update'}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(e.target.value);
        }}
      />
      {errors.$slug && <p className="text-mnml-danger">{errors.$slug}</p>}
    </div>
  );

  return (
    <RefOptionsProvider value={refOptions}>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <AdminHeader crumbs={crumbs}>
          {isCollection && mode === 'update' && <StatusDot state={dotState} className="mx-1" />}
          {result && (
            <span role="status" className={`max-sm:hidden ${result.ok ? 'text-mnml-primary' : 'text-mnml-danger'}`}>
              {result.message}
            </span>
          )}
          {canPreview && (
            <Button
              type="button"
              variant={showPreview ? 'secondary' : 'outline'}
              aria-pressed={showPreview}
              className="max-lg:hidden"
              onClick={() => setPreviewHidden(showPreview)}
            >
              <EyeIcon /> Preview
            </Button>
          )}
          {isCollection ? (
            <>
              <Button type="button" variant={showPublish ? 'outline' : 'default'} disabled={pending || !dirty} onClick={() => save('draft')}>
                Save draft
              </Button>
              {showPublish && (
                <Button type="submit" disabled={pending || !canPublish} className="px-4">
                  {pending ? 'Saving…' : 'Publish'}
                </Button>
              )}
            </>
          ) : (
            <Button type="submit" disabled={pending || !dirty} className="px-4">
              {pending ? 'Saving…' : 'Save'}
            </Button>
          )}
          {(published || actions) && (
            <ActionMenu>
              {published && (
                <MenuItem disabled={pending} onClick={() => save('unpublish')}>
                  <FileXIcon /> Unpublish
                </MenuItem>
              )}
              {actions}
            </ActionMenu>
          )}
        </AdminHeader>
        <div className="flex flex-1">
          <div className={showPreview ? 'w-[min(36rem,45%)] shrink-0' : 'w-full'}>
            <div className={`${bodyClass} flex flex-col gap-6`}>
              {tabs.length > 0 && (
                <div className="sticky top-14 z-10 -mx-6 border-b border-mnml-line bg-mnml-bg/90 px-6 py-3 backdrop-blur">
                  <div
                    role="tablist"
                    aria-label="Field groups"
                    className="flex gap-1 overflow-x-auto"
                    onKeyDown={(e) => {
                      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                      if (!step) return;
                      e.preventDefault();
                      const next = tabs[(tabs.findIndex((t) => t.id === tab) + step + tabs.length) % tabs.length];
                      setTab(next.id);
                      e.currentTarget.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)?.focus();
                    }}
                  >
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        data-tab={t.id}
                        aria-selected={tab === t.id}
                        tabIndex={tab === t.id ? 0 : -1}
                        onClick={() => setTab(t.id)}
                        className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mnml-primary/40 ${
                          tab === t.id ? 'bg-mnml-primary text-mnml-on-primary' : 'mnml-state text-mnml-text-soft'
                        }`}
                      >
                        {t.label}
                        {errorTabs.has(t.id) && <span role="img" aria-label="Has errors" className="size-1.5 rounded-full bg-mnml-danger ring-2 ring-mnml-bg/60" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {Object.entries(fields).filter(([k]) => inTab(k)).map(([k, f]) => (
                <div key={k} className="contents">
                  <FieldRenderer field={f} value={data[k]} onChange={(v) => set(k, v)} path={k} errors={errors} />
                  {def.kind === 'collection' && k === def.titleField && slugField}
                  {derived.filter((d) => d.after === k).map((d) => (
                    <DerivedRow key={d.key} label={d.label} value={d.value} />
                  ))}
                </div>
              ))}
              {(tab === ALL || tab === GENERAL) && derived.filter((d) => !d.after || !(d.after in fields)).map((d) => (
                <DerivedRow key={d.key} label={d.label} value={d.value} />
              ))}
            </div>
          </div>
          {showPreview && (
            <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] min-w-0 flex-1">
              <LivePreview input={input()} onClose={() => setPreviewHidden(true)} />
            </div>
          )}
        </div>
      </form>
    </RefOptionsProvider>
  );
}

const ALL = '$all';
const GENERAL = '$general';

/** A computed value, in the same place and shape as a field but not editable. */
function DerivedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>
        {label}
        <span className="ml-2 rounded-full bg-mnml-surface px-2 py-0.5 text-xs font-normal text-mnml-text-mute">Computed</span>
      </span>
      <output className="rounded-[6px] border border-dashed border-mnml-line bg-mnml-panel px-3 py-1.5 text-mnml-text-soft">{value}</output>
    </div>
  );
}

// The preview pane only fits on wide screens; on narrow ones it is never mounted.
const WIDE = '(min-width: 1024px)';
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const isWide = () => window.matchMedia(WIDE).matches;
