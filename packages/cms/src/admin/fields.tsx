'use client';

import { createContext, use, useRef, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, Trash2Icon, UploadIcon, XIcon } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { isVisible, withDefaults, type ArrayField, type BlocksField, type Field, type GroupField, type ImageValue } from '../define.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { RichTextEditor } from './rich-text-editor.js';
import { uploadImage } from './upload.js';
import { inputClass, labelClass } from './styles.js';

export type Errors = Record<string, string>;

type Props = { field: Field; value: unknown; onChange: (v: unknown) => void; path: string; errors: Errors };
/** `siblings` are the values of the fields next to this one, which its `showIf` is checked against. */
type RenderProps = Props & { siblings: unknown };

/** Entries that `reference` fields can point at, by collection key. Provided by the entry form. */
export type RefOptions = Record<string, { slug: string; label: string }[]>;
const RefOptionsContext = createContext<RefOptions>({});
export const RefOptionsProvider = RefOptionsContext;

export function FieldRenderer({ field, value, onChange, path, errors, siblings }: RenderProps) {
  if (!isVisible(field, siblings)) return null;
  const error = errors[path];
  const id = `f-${path}`;
  if (field.type === 'group') {
    return <GroupInput field={field} value={(value as Record<string, unknown>) ?? {}} onChange={onChange} path={path} errors={errors} />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {field.label}
        {field.required && <span className="text-mnml-danger"> *</span>}
      </label>
      {field.help && <p className="-mt-1 text-mnml-text-mute">{field.help}</p>}
      <Input id={id} field={field} value={value} onChange={onChange} path={path} errors={errors} invalid={!!error} />
      {error && <p className="text-mnml-danger">{error}</p>}
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
      return <ImageInput id={id} value={value as ImageValue | null} onChange={onChange} />;
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          className="size-4 self-start accent-mnml-primary"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          className={`${inputClass} w-auto`}
          aria-invalid={invalid}
          value={(value as number | null) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'select':
      return (
        <select
          id={id}
          className={`${inputClass} w-auto`}
          aria-invalid={invalid}
          value={(value as string | null) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'reference':
      return <ReferenceInput id={id} collection={field.collection} value={value as string | null} onChange={onChange} invalid={invalid} />;
    case 'group':
      return null; // rendered by FieldRenderer as a section
    case 'richtext':
      return <RichTextEditor value={value as JSONContent} onChange={onChange} invalid={invalid} />;
    case 'tags':
      return <TagsInput id={id} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'array':
      return <ArrayInput field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} path={path} errors={errors} />;
    case 'blocks':
      return <BlocksInput field={field} value={(value as Block[]) ?? []} onChange={onChange} path={path} errors={errors} />;
  }
}

function GroupInput({
  field,
  value,
  onChange,
  path,
  errors,
}: {
  field: GroupField;
  value: Record<string, unknown>;
  onChange: (v: unknown) => void;
  path: string;
  errors: Errors;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-mnml-line px-4 pb-4 pt-3">
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.help && <p className="-mt-1 text-mnml-text-mute">{field.help}</p>}
      {Object.entries(field.fields).map(([k, f]) => (
        <FieldRenderer
          key={k}
          field={f}
          value={value[k]}
          onChange={(v) => onChange({ ...value, [k]: v })}
          path={`${path}.${k}`}
          errors={errors}
          siblings={value}
        />
      ))}
    </fieldset>
  );
}

function ReferenceInput({
  id,
  collection,
  value,
  onChange,
  invalid,
}: {
  id: string;
  collection: string;
  value: string | null;
  onChange: (v: unknown) => void;
  invalid: boolean;
}) {
  const options = use(RefOptionsContext)[collection] ?? [];
  // Keep a current value that is no longer offered (e.g. since unpublished) visible instead of silently dropping it.
  const missing = value && !options.some((o) => o.slug === value);
  return (
    <select id={id} className={`${inputClass} w-auto`} aria-invalid={invalid} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {missing && <option value={value}>{value} (unavailable)</option>}
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ImageInput({ id, value, onChange }: { id: string; value: ImageValue | null; onChange: (v: ImageValue | null) => void }) {
  const { apiPath } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      onChange({ url: await uploadImage(apiPath, f), alt: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {value ? (
          // Plain <img>: previews may be any uploaded URL, no need for next/image here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt="" className="size-16 rounded-[6px] border border-mnml-line object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-[6px] border border-dashed border-mnml-line text-xs text-mnml-text-mute">None</div>
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
      {error && <p className="break-words text-mnml-danger">{error}</p>}
      {value && (
        <input
          aria-label="Alt text"
          placeholder="Alt text: describe the image (leave empty only if decorative)"
          maxLength={300}
          className={inputClass}
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
        />
      )}
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
    <div className={`${inputClass} flex flex-wrap items-center gap-1 focus-within:border-mnml-primary`}>
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-[4px] bg-mnml-surface py-0.5 pl-2 pr-0.5 text-xs text-mnml-text">
          {t}
          <button type="button" aria-label={`Remove ${t}`} className="mnml-state rounded p-0.5" onClick={() => onChange(value.filter((x) => x !== t))}>
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

/** Open row, edit, reorder and remove for a list of items, shared by `array` and `blocks`. */
function useListEditing<T>(value: T[], onChange: (v: unknown) => void) {
  const [open, setOpen] = useState<number | null>(null);
  const update = (i: number, item: T) => onChange(value.map((v, j) => (j === i ? item : v)));
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
  return { open, setOpen, update, move, remove };
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
  const { open, setOpen, update, move, remove } = useListEditing(value, onChange);
  const add = () => {
    onChange([...value, withDefaults(field.fields, {})]);
    setOpen(value.length);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <ul className="w-full divide-y divide-mnml-line overflow-hidden rounded-[8px] border border-mnml-line">
        {value.length === 0 && <li className="px-3 py-2.5 text-mnml-text-mute">No items</li>}
        {value.map((item, i) => {
          const isOpen = open === i;
          const hasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
          return (
            <li key={i}>
              <div className={`flex items-center gap-1 pr-1.5 ${isOpen ? 'bg-mnml-panel' : 'hover:bg-mnml-panel'}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                >
                  <ChevronRightIcon className={`size-4 shrink-0 text-mnml-text-mute transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="truncate">{(field.itemLabel && String(item[field.itemLabel] ?? '')) || `Item ${i + 1}`}</span>
                  {hasError && <span className="shrink-0 text-xs text-mnml-danger">Needs attention</span>}
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
                <div className="flex flex-col gap-4 border-t border-mnml-line px-4 py-4 sm:pl-9">
                  {Object.entries(field.fields).map(([k, f]) => (
                    <FieldRenderer
                      key={k}
                      field={f}
                      value={item[k]}
                      onChange={(v) => update(i, { ...item, [k]: v })}
                      path={`${path}.${i}.${k}`}
                      errors={errors}
                      siblings={item}
                    />
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

type Block = { kind: string } & Record<string, unknown>;

// Like ArrayInput, but each item is one of the field's blocks: "Add" picks which, and the row shows only that block's fields.
function BlocksInput({
  field,
  value,
  onChange,
  path,
  errors,
}: {
  field: BlocksField;
  value: Block[];
  onChange: (v: unknown) => void;
  path: string;
  errors: Errors;
}) {
  const { open, setOpen, update, move, remove } = useListEditing(value, onChange);
  const add = (kind: string) => {
    onChange([...value, { kind, ...withDefaults(field.blocks[kind].fields, {}) }]);
    setOpen(value.length);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <ul className="w-full divide-y divide-mnml-line overflow-hidden rounded-[8px] border border-mnml-line">
        {value.length === 0 && <li className="px-3 py-2.5 text-mnml-text-mute">No items</li>}
        {value.map((item, i) => {
          const def = field.blocks[item.kind];
          if (!def) return null;
          const isOpen = open === i;
          const hasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
          const title = field.itemLabel && field.itemLabel in def.fields ? String(item[field.itemLabel] ?? '') : '';
          return (
            <li key={i}>
              <div className={`flex items-center gap-1 pr-1.5 ${isOpen ? 'bg-mnml-panel' : 'hover:bg-mnml-panel'}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                >
                  <ChevronRightIcon className={`size-4 shrink-0 text-mnml-text-mute transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="shrink-0 rounded-[4px] bg-mnml-surface px-1.5 py-0.5 text-xs text-mnml-text-mute">{def.label}</span>
                  <span className="truncate">{title}</span>
                  {hasError && <span className="shrink-0 text-xs text-mnml-danger">Needs attention</span>}
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
                <div className="flex flex-col gap-4 border-t border-mnml-line px-4 py-4 sm:pl-9">
                  {Object.keys(def.fields).length === 0 && <p className="text-mnml-text-mute">Nothing to edit.</p>}
                  {Object.entries(def.fields).map(([k, f]) => (
                    <FieldRenderer
                      key={k}
                      field={f}
                      value={item[k]}
                      onChange={(v) => update(i, { ...item, [k]: v })}
                      path={`${path}.${i}.${k}`}
                      errors={errors}
                      siblings={item}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {Object.entries(field.blocks).map(([kind, b]) => (
          <Button key={kind} type="button" variant="outline" size="sm" onClick={() => add(kind)}>
            <PlusIcon /> {b.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
