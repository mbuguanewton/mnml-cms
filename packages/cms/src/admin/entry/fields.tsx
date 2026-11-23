'use client';

import { createContext, use, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CrosshairIcon,
  ImagePlusIcon,
  ImagesIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import {
  initialValues,
  isVisible,
  type ArrayField,
  type Block,
  type BlocksField,
  type Field,
  type GroupField,
  type ImageValue,
  type Limits,
  type ReferencesField,
} from '../../schema/define.js';
import { fromLocalInput, toLocalInput } from '../../schema/datetime.js';
import { displayText } from '../../schema/text.js';
import { EntryCombobox } from './entry-combobox.js';
import { useMenu } from '../shell/action-menu.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { DatePicker } from '../ui/date-picker.js';
import { Input as TextInput, Textarea } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Tooltip } from '../ui/tooltip.js';
import { mediaName } from '../shell/media-name.js';
import { useAdmin } from '../shell/context.js';
import { RichTextEditor } from '../editor/rich-text-editor.js';
import { MediaPicker } from '../editor/media-picker.js';
import { uploadImage } from '../editor/upload.js';
import { inputClass, labelClass } from '../ui/styles.js';

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
      return <TextInput id={id} invalid={invalid} value={(value as string) ?? ''} onChange={onChange} />;
    case 'textarea':
      return <Textarea id={id} invalid={invalid} value={(value as string) ?? ''} onChange={onChange} />;
    case 'date':
      return <DatePicker id={id} invalid={invalid} value={(value as string | null) || null} onChange={onChange} />;
    case 'datetime':
      return <DatetimeInput id={id} value={value as string | null} onChange={onChange} invalid={invalid} />;
    case 'url':
      return (
        <TextInput id={id} inputMode="url" placeholder="https://" invalid={invalid} value={(value as string) ?? ''} onChange={(v) => onChange(v || null)} />
      );
    case 'image':
      return <ImageInput id={id} value={value as ImageValue | null} onChange={onChange} />;
    case 'boolean':
      return <Checkbox id={id} invalid={invalid} className="self-start" checked={value === true} onChange={onChange} />;
    case 'number':
      return (
        <TextInput
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          invalid={invalid}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(v) => onChange(v === '' ? null : Number(v))}
        />
      );
    case 'select':
      // A stored value that is no longer an option stays visible, marked unavailable.
      return (
        <Select
          id={id}
          clearable
          invalid={invalid}
          value={(value as string | null) || null}
          onChange={onChange}
          options={field.options.map((o) => ({ value: o, label: field.optionLabels?.[o] ?? o }))}
        />
      );
    case 'reference':
      return <ReferenceInput id={id} collection={field.collection} value={value as string | null} onChange={onChange} invalid={invalid} />;
    case 'references':
      return <ReferencesInput id={id} field={field} value={(value as string[]) ?? []} onChange={onChange} invalid={invalid} />;
    case 'group':
      return null; // rendered by FieldRenderer as a section
    case 'richtext':
      return <RichTextEditor value={value as JSONContent} onChange={onChange} invalid={invalid} label={field.label} />;
    case 'tags':
      return <TagsInput id={id} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'array':
      return <ArrayInput field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} path={path} errors={errors} />;
    case 'blocks':
      return <BlocksInput field={field} value={(value as BlockItem[]) ?? []} onChange={onChange} path={path} errors={errors} />;
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
  const label = value ? (options.find((o) => o.slug === value)?.label ?? `${value} (unavailable)`) : null;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center gap-2 rounded-[6px] border border-mnml-line bg-mnml-bg px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Clear ${label}`} onClick={() => onChange(null)}>
            <XIcon />
          </Button>
        </div>
      )}
      <EntryCombobox
        id={id}
        options={options.filter((o) => o.slug !== value)}
        onPick={onChange}
        placeholder={value ? 'Search to replace…' : 'Search…'}
        invalid={invalid}
      />
    </div>
  );
}

/** An icon button for the image toolbar, with its name as a tooltip and `aria-label`. */
function ToolButton({
  label,
  onClick,
  pressed,
  controls,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  controls?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-expanded={pressed}
        aria-controls={controls}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function ImageInput({ id, value, onChange }: { id: string; value: ImageValue | null; onChange: (v: ImageValue | null) => void }) {
  const { apiPath, mediaLibrary } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState<{ url: string; w: number; h: number } | null>(null);

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      // A new image starts without a focal point: the old one belonged to the old image.
      onChange({ url: await uploadImage(apiPath, f), alt: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pickFile = () => file.current?.click();
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy) void upload(f);
  };

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative overflow-hidden rounded-[6px] border border-mnml-line bg-mnml-surface">
          {picking ? (
            <FocalPointPicker id={`${id}-focal`} value={value} onChange={onChange} onClose={() => setPicking(false)} />
          ) : (
            <>
              {/* Plain <img>: previews may be any uploaded URL, no need for next/image here. */}
              {/* oxlint-disable-next-line nextjs/no-img-element */}
              <img
                src={value.url}
                alt=""
                className="block max-h-72 min-h-24 w-full object-cover"
                onLoad={(e) => setSize({ url: value.url, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              <div
                role="toolbar"
                aria-label="Image actions"
                className="absolute right-2 top-2 flex gap-0.5 rounded-[8px] border border-mnml-line bg-mnml-bg/90 p-0.5 shadow-sm backdrop-blur"
              >
                <ToolButton label={busy ? 'Uploading…' : 'Replace'} onClick={pickFile} disabled={busy}>
                  <UploadIcon />
                </ToolButton>
                {mediaLibrary && (
                  <ToolButton label="Choose from uploads" onClick={() => setChoosing(true)} disabled={busy}>
                    <ImagesIcon />
                  </ToolButton>
                )}
                <ToolButton label="Focal point" onClick={() => setPicking(true)} controls={`${id}-focal`}>
                  <CrosshairIcon />
                </ToolButton>
                <ToolButton label="Remove" onClick={() => onChange(null)}>
                  <Trash2Icon />
                </ToolButton>
              </div>
              <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-mnml-line bg-mnml-bg/90 px-2.5 py-1 text-xs backdrop-blur">
                {mediaName(value.url.split('?')[0] ?? value.url)}
                {size?.url === value.url && ` · ${size.w}×${size.h}`}
              </span>
            </>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`flex flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed px-4 py-8 text-center ${dragging ? 'border-mnml-primary bg-mnml-surface' : 'border-mnml-line'}`}
        >
          <ImagePlusIcon className="size-6 text-mnml-text-mute" aria-hidden />
          <p>
            {busy ? 'Uploading…' : 'Drop an image or '}
            {!busy && (
              <button id={id} type="button" className="text-mnml-primary underline underline-offset-2" onClick={pickFile}>
                browse
              </button>
            )}
          </p>
          {mediaLibrary && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setChoosing(true)}>
              <ImagesIcon /> Choose from uploads
            </Button>
          )}
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
      />
      {mediaLibrary && (
        <MediaPicker
          open={choosing}
          onClose={() => setChoosing(false)}
          // Like a fresh upload: no alt text, no focal point (those belonged to the old image).
          onPick={(url) => {
            setChoosing(false);
            onChange({ url, alt: '' });
          }}
        />
      )}
      {error && <p className="break-words text-mnml-danger">{error}</p>}
      {value && (
        <TextInput
          aria-label="Alt text"
          placeholder="Describe the image (leave empty if decorative)"
          maxLength={300}
          value={value.alt}
          onChange={(alt) => onChange({ ...value, alt })}
        />
      )}
    </div>
  );
}

const clamp01 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** Covers the preview with the whole image: click (or use the arrow keys) to set the point that stays in frame when it's cropped. */
function FocalPointPicker({ id, value, onChange, onClose }: { id: string; value: ImageValue; onChange: (v: ImageValue | null) => void; onClose: () => void }) {
  const has = typeof value.focalX === 'number' && typeof value.focalY === 'number';
  const x = has ? (value.focalX as number) : 0.5;
  const y = has ? (value.focalY as number) : 0.5;
  const set = (fx: number, fy: number) => onChange({ ...value, focalX: clamp01(fx), focalY: clamp01(fy) });
  const reset = () => {
    const { focalX: _x, focalY: _y, ...rest } = value;
    onChange(rest);
  };
  const label = has ? `Focal point: ${pct(x)} across, ${pct(y)} down` : 'Focal point: not set, the centre is used';
  const area = useRef<HTMLDivElement>(null);
  // Keyboard users land on the picker, like opening a dialog.
  useEffect(() => area.current?.focus(), []);

  return (
    <div id={id} className="flex justify-center">
      <div
        ref={area}
        tabIndex={0}
        role="application"
        aria-roledescription="focal point picker"
        aria-label={label}
        aria-describedby={`${id}-hint`}
        className="relative inline-block max-w-full cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary/40"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            return onClose();
          }
          const step = e.shiftKey ? 0.01 : 0.05;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const m = moves[e.key];
          if (!m) return;
          e.preventDefault();
          set(x + m[0], y + m[1]);
        }}
      >
        {/* oxlint-disable-next-line nextjs/no-img-element */}
        <img src={value.url} alt="" draggable={false} className="block max-h-72 max-w-full select-none" />
        <span
          aria-hidden
          className={`pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] ${has ? 'bg-black/30' : 'border-dashed opacity-70'}`}
          style={{ left: pct(x), top: pct(y) }}
        />
      </div>
      <div className="absolute right-2 top-2 flex gap-0.5 rounded-[8px] border border-mnml-line bg-mnml-bg/90 p-0.5 shadow-sm backdrop-blur">
        {has && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        )}
        <ToolButton label="Close focal point" onClick={onClose}>
          <XIcon />
        </ToolButton>
      </div>
      <p
        id={`${id}-hint`}
        className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-mnml-line bg-mnml-bg/90 px-2.5 py-1 text-xs backdrop-blur"
      >
        Click to set the point to keep in frame · arrows nudge (Shift: finer)
      </p>
    </div>
  );
}

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** A date and time in the editor's time zone, saved as UTC. */
function DatetimeInput({ id, value, onChange, invalid }: { id: string; value: string | null; onChange: (v: unknown) => void; invalid: boolean }) {
  // Local time depends on the browser's time zone, which the server render doesn't know: null there and while
  // hydrating, then the browser's zone.
  const zone = useSyncExternalStore(noSubscribe, browserTimeZone, () => null);
  return (
    <div className="flex flex-col gap-1">
      <DatePicker
        id={id}
        time
        timeInCalendar
        invalid={invalid}
        aria-describedby={zone ? `${id}-zone` : undefined}
        disabled={!zone}
        value={zone ? toLocalInput(value) || null : null}
        onChange={(v) => onChange(v ? fromLocalInput(v) : null)}
      />
      {zone && (
        <p id={`${id}-zone`} className="text-xs text-mnml-text-mute">
          Times are in {zone}
        </p>
      )}
    </div>
  );
}

/** Several entries of one collection, in order: the picked ones (reorder, remove), then a select to add more. */
function ReferencesInput({
  id,
  field,
  value,
  onChange,
  invalid,
}: {
  id: string;
  field: ReferencesField;
  value: string[];
  onChange: (v: unknown) => void;
  invalid: boolean;
}) {
  const options = use(RefOptionsContext)[field.collection] ?? [];
  const label = (slug: string) => options.find((o) => o.slug === slug)?.label;
  const { move, remove } = useListEditing(value, onChange);
  const remaining = options.filter((o) => !value.includes(o.slug));
  const full = field.max !== undefined && value.length >= field.max;
  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <ol aria-label={`${field.label}: picked`} className="flex flex-col divide-y divide-mnml-line rounded-[6px] border border-mnml-line bg-mnml-bg">
          {value.map((slug, i) => (
            <li key={slug} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                {/* Keep an entry that is no longer offered (e.g. since unpublished) visible instead of silently dropping it. */}
                {label(slug) ?? `${slug} (unavailable)`}
              </span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${label(slug) ?? slug} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${label(slug) ?? slug} down`}
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${label(slug) ?? slug}`} onClick={() => remove(i)}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <EntryCombobox
        id={id}
        options={remaining}
        onPick={(slug) => onChange([...value, slug])}
        disabled={full || remaining.length === 0}
        placeholder={full ? `Maximum of ${field.max} reached` : remaining.length ? 'Search to add…' : 'Nothing more to add'}
        invalid={invalid}
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
    onChange([...value, initialValues(field.fields)]);
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
                  <span className="truncate">{(field.itemLabel && displayText(item[field.itemLabel])) || `Item ${i + 1}`}</span>
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
      <AddRow field={field} count={value.length}>
        {(full) => (
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={full}>
            <PlusIcon /> Add
          </Button>
        )}
      </AddRow>
    </div>
  );
}

type BlockItem = { kind: string } & Record<string, unknown>;

// Like ArrayInput, but each item is one of the field's blocks: "Add" picks which, and the row shows only that block's fields.
function BlocksInput({
  field,
  value,
  onChange,
  path,
  errors,
}: {
  field: BlocksField;
  value: BlockItem[];
  onChange: (v: unknown) => void;
  path: string;
  errors: Errors;
}) {
  const { open, setOpen, update, move, remove } = useListEditing(value, onChange);
  const add = (kind: string) => {
    onChange([...value, { kind, ...initialValues(field.blocks[kind].fields) }]);
    setOpen(value.length);
  };
  // "Sections" → "Add section"
  const addLabel = field.addLabel ?? `Add ${field.label.replace(/(?<!s)s$/i, '').toLowerCase()}`;

  return (
    <div className="flex flex-col items-start gap-2">
      <ul className="w-full divide-y divide-mnml-line overflow-hidden rounded-[8px] border border-mnml-line">
        {value.length === 0 && <li className="px-3 py-3 text-mnml-text-mute">Nothing here yet. Use “{addLabel}” below.</li>}
        {value.map((item, i) => {
          const def = field.blocks[item.kind];
          if (!def) return null;
          const isOpen = open === i;
          const hasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
          const title = field.itemLabel && field.itemLabel in def.fields ? displayText(item[field.itemLabel]) : '';
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
      <AddRow field={field} count={value.length}>
        {(full) => <BlockPicker blocks={field.blocks} label={addLabel} onPick={add} disabled={full} />}
      </AddRow>
    </div>
  );
}

// More than this many blocks and the picker gets a search box.
const SEARCH_FROM = 8;

/** An Add control, disabled with the reason once a list field has `max` items. */
function AddRow({ field, count, children }: { field: Limits; count: number; children: (full: boolean) => React.ReactNode }) {
  const full = field.max !== undefined && count >= field.max;
  return (
    <div className="flex items-center gap-3">
      {children(full)}
      {full && <span className="text-xs text-mnml-text-mute">Maximum of {field.max} reached</span>}
    </div>
  );
}

/** One "Add" button that opens the list of block kinds, so the form doesn't grow with them. */
function BlockPicker({
  blocks,
  label,
  onPick,
  disabled,
}: {
  blocks: Record<string, Block>;
  label: string;
  onPick: (kind: string) => void;
  disabled?: boolean;
}) {
  const { open, setOpen, root } = useMenu();
  const [q, setQ] = useState('');
  const popup = useRef<HTMLDivElement>(null);
  const all = Object.entries(blocks);
  const needle = q.trim().toLowerCase();
  const shown = all.filter(([kind, b]) => !needle || `${b.label} ${kind} ${b.description ?? ''}`.toLowerCase().includes(needle));

  // Land on the search box (or the first block) so the keyboard works straight away.
  useEffect(() => {
    if (open) popup.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [open]);

  const pick = (kind: string) => {
    setOpen(false);
    onPick(kind);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = [...(popup.current?.querySelectorAll<HTMLElement>('input, button') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[Math.min(items.length - 1, Math.max(0, at + step))]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setQ('');
          setOpen(!open);
        }}
      >
        <PlusIcon /> {label} <ChevronDownIcon className="text-mnml-text-mute" />
      </Button>
      {open && (
        <div
          ref={popup}
          role="menu"
          onKeyDown={onKeyDown}
          className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-3rem)] rounded-[8px] border border-mnml-line bg-mnml-bg p-1 shadow-lg"
        >
          {all.length > SEARCH_FROM && (
            <TextInput
              aria-label="Search blocks"
              placeholder="Search…"
              className="mb-1"
              value={q}
              onChange={setQ}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (shown[0]) pick(shown[0][0]);
                }
              }}
            />
          )}
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {shown.length === 0 && <p className="px-2.5 py-2 text-mnml-text-mute">No match</p>}
            {shown.map(([kind, b]) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => pick(kind)}
                className="flex w-full cursor-pointer flex-col items-start rounded-[4px] px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-mnml-surface focus-visible:bg-mnml-surface"
              >
                <span className="text-sm text-mnml-text">{b.label}</span>
                {b.description && <span className="text-xs text-mnml-text-mute">{b.description}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
