'use client';

import { useRef, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, Trash2Icon, UploadIcon, XIcon } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { withDefaults, type ArrayField, type Field } from '../define.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { RichTextEditor } from './rich-text-editor.js';
import { uploadImage } from './upload.js';
import { inputClass, labelClass } from './styles.js';

export type Errors = Record<string, string>;

type Props = { field: Field; value: unknown; onChange: (v: unknown) => void; path: string; errors: Errors };

export function FieldRenderer({ field, value, onChange, path, errors }: Props) {
  const error = errors[path];
  const id = `f-${path}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {field.label}
        {field.required && <span className="text-cms-danger"> *</span>}
      </label>
      {field.help && <p className="-mt-1 text-cms-text-mute">{field.help}</p>}
      <Input id={id} field={field} value={value} onChange={onChange} path={path} errors={errors} invalid={!!error} />
      {error && <p className="text-cms-danger">{error}</p>}
    </div>
  );
}

function Input({ id, field, value, onChange, path, errors, invalid }: Props & { id: string; invalid: boolean }) {
  switch (field.type) {
    case 'text':
      return <input id={id} className={inputClass} aria-invalid={invalid} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return (
        <textarea id={id} rows={4} className={inputClass} aria-invalid={invalid} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      );
    case 'date':
      return (
        <input
          id={id}
          type="date"
          className={`${inputClass} w-auto`}
          aria-invalid={invalid}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'url':
      return (
        <input
          id={id}
          inputMode="url"
          placeholder="https://"
          className={inputClass}
          aria-invalid={invalid}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'image':
      return <ImageInput id={id} value={value as string | null} onChange={onChange} />;
    case 'richtext':
      return <RichTextEditor value={value as JSONContent} onChange={onChange} invalid={invalid} />;
    case 'tags':
      return <TagsInput id={id} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'array':
      return <ArrayInput field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} path={path} errors={errors} />;
  }
}

function ImageInput({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  const { apiPath } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(apiPath, f));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // Plain <img>: previews may be any uploaded URL, no need for next/image here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="size-16 rounded-[6px] border border-cms-line object-cover" />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-[6px] border border-dashed border-cms-line text-xs text-cms-text-mute">None</div>
      )}
      <div className="flex flex-col items-start gap-2">
        <div className="flex gap-2">
          <Button id={id} type="button" variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}>
            <UploadIcon /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-cms-danger">{error}</p>}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) upload(f);
        }}
      />
    </div>
  );
}

function TagsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className={`${inputClass} flex flex-wrap items-center gap-1 focus-within:border-cms-primary`}>
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-[4px] bg-cms-surface py-0.5 pl-2 pr-0.5 text-xs text-cms-text">
          {t}
          <button type="button" aria-label={`Remove ${t}`} className="cms-state rounded p-0.5" onClick={() => onChange(value.filter((x) => x !== t))}>
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-32 flex-1 bg-transparent focus:outline-none"
        placeholder="Type and press Enter"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

// Keystatic-style list: one row per item, expanded inline one at a time.
function ArrayInput({
  field,
  value,
  onChange,
  path,
  errors,
}: {
  field: ArrayField;
  value: Record<string, unknown>[];
  onChange: (v: unknown) => void;
  path: string;
  errors: Errors;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const update = (i: number, item: Record<string, unknown>) => onChange(value.map((v, j) => (j === i ? item : v)));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    if (open === i) setOpen(i + d);
    else if (open === i + d) setOpen(i);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, j) => j !== i));
    if (open === i) setOpen(null);
    else if (open !== null && open > i) setOpen(open - 1);
  };
  const add = () => {
    onChange([...value, withDefaults(field.fields, {})]);
    setOpen(value.length);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <ul className="w-full divide-y divide-cms-line overflow-hidden rounded-[8px] border border-cms-line">
        {value.length === 0 && <li className="px-3 py-2.5 text-cms-text-mute">No items</li>}
        {value.map((item, i) => {
          const isOpen = open === i;
          const hasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
          return (
            <li key={i}>
              <div className={`flex items-center gap-1 pr-1.5 ${isOpen ? 'bg-cms-panel' : 'hover:bg-cms-panel'}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                >
                  <ChevronRightIcon className={`size-4 shrink-0 text-cms-text-mute transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="truncate">{(field.itemLabel && String(item[field.itemLabel] ?? '')) || `Item ${i + 1}`}</span>
                  {hasError && <span className="shrink-0 text-xs text-cms-danger">Needs attention</span>}
                </button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => remove(i)}>
                  <Trash2Icon />
                </Button>
              </div>
              {isOpen && (
                <div className="flex flex-col gap-4 border-t border-cms-line px-4 py-4 sm:pl-9">
                  {Object.entries(field.fields).map(([k, f]) => (
                    <FieldRenderer key={k} field={f} value={item[k]} onChange={(v) => update(i, { ...item, [k]: v })} path={`${path}.${i}.${k}`} errors={errors} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <PlusIcon /> Add
      </Button>
    </div>
  );
}
