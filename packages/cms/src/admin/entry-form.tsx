'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon } from 'lucide-react';
import { slugify, type Collection, type Fields, type Singleton } from '../define.js';
import type { EntryInput, SaveResult } from '../api.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { FieldRenderer } from './fields.js';
import { LivePreview } from './live-preview.js';
import { AdminHeader, type Crumb } from './header.js';
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
  /** Extra buttons shown in the header next to Save. */
  actions?: React.ReactNode;
};

export function EntryForm({ schemaKey, schema: def, initial, slug: existingSlug, notice, crumbs, actions }: Props) {
  const { post } = useAdmin();
  const router = useRouter();
  const fields: Fields = def.fields;
  const mode: 'create' | 'update' = def.kind === 'collection' && !existingSlug ? 'create' : 'update';
  const [data, setData] = useState(initial);
  const [slug, setSlug] = useState(existingSlug ?? '');
  const [slugEdited, setSlugEdited] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(notice ? { ok: true, message: notice } : null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? result.errors : {};

  const set = (key: string, value: unknown) => {
    setData((d) => ({ ...d, [key]: value }));
    // Derive the slug from the title until the editor types their own.
    if (mode === 'create' && def.kind === 'collection' && key === def.titleField && !slugEdited) setSlug(slugify(String(value)));
  };

  const input = (): EntryInput => ({ key: schemaKey, slug: def.kind === 'collection' ? slug : undefined, mode, data });
  const canPreview = def.preview !== undefined && def.preview !== false;
  const [previewHidden, setPreviewHidden] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const showPreview = canPreview && wide && !previewHidden;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await post<SaveResult>('save', input());
      if (r.ok && r.redirect) {
        router.push(r.redirect);
        return;
      }
      setResult(r);
      if (r.ok) router.refresh();
    });
  };

  const slugField = def.kind === 'collection' && (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="f-slug" className={labelClass}>
        Slug
      </label>
      <p className="-mt-1 text-cms-text-mute">{mode === 'update' ? 'The URL is fixed once an entry is created.' : 'Used in the URL. Filled in from the title.'}</p>
      <input
        id="f-slug"
        className={`${inputClass} [font-family:ui-monospace,monospace] text-xs read-only:bg-cms-panel read-only:text-cms-text-soft`}
        aria-invalid={!!errors.$slug}
        value={slug}
        readOnly={mode === 'update'}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(e.target.value);
        }}
      />
      {errors.$slug && <p className="text-cms-danger">{errors.$slug}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <AdminHeader crumbs={crumbs}>
        {result && (
          <span role="status" className={`max-sm:hidden ${result.ok ? 'text-cms-primary' : 'text-cms-danger'}`}>
            {result.message}
          </span>
        )}
        {actions}
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
        <Button type="submit" disabled={pending} className="px-4">
          {pending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </AdminHeader>
      <div className="flex flex-1">
        <div className={showPreview ? 'w-[min(36rem,45%)] shrink-0' : 'w-full'}>
          <div className={`${bodyClass} flex flex-col gap-6`}>
            {Object.entries(fields).map(([k, f]) => (
              <div key={k} className="contents">
                <FieldRenderer field={f} value={data[k]} onChange={(v) => set(k, v)} path={k} errors={errors} />
                {def.kind === 'collection' && k === def.titleField && slugField}
              </div>
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
