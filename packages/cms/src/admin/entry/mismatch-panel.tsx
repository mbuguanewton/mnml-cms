'use client';

import { createContext, use, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import type { Field } from '../../schema/define.js';
import { convertValue, docToText, type Mismatch } from '../../schema/fit.js';
import { Button } from '../ui/button.js';
import { Input, Textarea } from '../ui/input.js';
import { labelClass } from '../ui/styles.js';

/** The values set aside because they don't fit their field, by form path, and how to settle one. */
export type MismatchState = {
  open: Record<string, Mismatch>;
  /** Settle a field: with a value (Use this), or without one (Remove: the form already holds the empty value). */
  resolve: (path: string, value?: { value: unknown }) => void;
  /** The field at a form path, so the card can check what the editor types. */
  fieldAt: (path: string) => Field | undefined;
};
export const MismatchContext = createContext<MismatchState>({ open: {}, resolve: () => {}, fieldAt: () => undefined });

// Fields whose suggestion is edited as text. A choice or a yes/no is picked in the field itself, after Use this.
// Edited in a box with several lines: the rest in one line.
const MULTILINE: ReadonlySet<Mismatch['type']> = new Set(['textarea', 'richtext', 'tags', 'references']);
const EDITABLE: ReadonlySet<Mismatch['type']> = new Set([
  'text',
  'textarea',
  'richtext',
  'url',
  'reference',
  'date',
  'datetime',
  'number',
  'tags',
  'references',
]);

const TYPE_NAME: Record<Mismatch['type'], string> = {
  text: 'text',
  textarea: 'text',
  date: 'date',
  datetime: 'date and time',
  url: 'link',
  image: 'image',
  boolean: 'yes/no',
  number: 'number',
  select: 'choice',
  reference: 'entry',
  references: 'entries',
  richtext: 'rich text',
  tags: 'tags',
  array: 'list',
  group: 'group',
  blocks: 'sections',
};

/** What a stored value is, in a few words. */
export function kindOf(v: unknown): string {
  if (typeof v === 'string') return 'text';
  if (typeof v === 'number') return 'a number';
  if (typeof v === 'boolean') return 'yes/no';
  if (Array.isArray(v)) return 'a list';
  if (v && typeof v === 'object' && (v as { type?: unknown }).type === 'doc') return 'rich text';
  return 'data';
}

const LIMIT = 600;

/** A stored or suggested value as something readable: text, rich text as its words, anything else as JSON. */
export function previewText(v: unknown): string {
  const text =
    typeof v === 'string'
      ? v
      : typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : v && typeof v === 'object' && (v as { type?: unknown }).type === 'doc'
          ? docToText(v as never)
          : Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')
            ? v.join(', ')
            : JSON.stringify(v, null, 2);
  return text.length > LIMIT ? `${text.slice(0, LIMIT)}…` : text;
}

const pre = 'max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[6px] bg-mnml-bg p-2 text-sm [font-family:inherit]';

/** Takes the place of a field whose stored value doesn't fit it: the old value, what it could become, and what to do. */
export function MismatchCard({ mismatch: m }: { mismatch: Mismatch }) {
  const { resolve, fieldAt } = use(MismatchContext);
  const field = fieldAt(m.path);
  const editable = !!m.suggestion && !!field && EDITABLE.has(m.type);
  // The suggestion as text the editor can change. What they type is checked as the field's own kind of value.
  const original = m.suggestion ? previewText(m.suggestion.value) : '';
  const [text, setText] = useState(original);
  const edited = text !== original;
  const converted = !editable || !edited ? m.suggestion : field ? convertValue(field, text) : null;
  return (
    <section
      id={`mismatch-${m.path}`}
      aria-label={`${m.label}: stored value doesn't fit`}
      className="flex flex-col gap-3 rounded-[8px] border border-dashed border-mnml-danger/50 bg-mnml-panel p-3"
    >
      <div className="flex flex-col gap-1">
        <p className={labelClass}>{m.label}</p>
        <p className="text-mnml-text-soft">
          Stored as {kindOf(m.stored)}, but this is now a {TYPE_NAME[m.type]} field.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-mnml-text-mute">Stored</p>
          <pre className={pre}>{previewText(m.stored)}</pre>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-mnml-text-mute">
            As a {TYPE_NAME[m.type]} field{editable && ' (edit it)'}
          </p>
          {editable ? (
            MULTILINE.has(m.type) ? (
              <Textarea aria-label={`${m.label}: value to use`} value={text} onChange={setText} invalid={!converted} className="min-h-16 text-sm" />
            ) : (
              <Input aria-label={`${m.label}: value to use`} value={text} onChange={setText} invalid={!converted} />
            )
          ) : m.suggestion ? (
            <pre className={pre}>{original}</pre>
          ) : (
            <p className="rounded-[6px] bg-mnml-bg p-2 text-mnml-text-mute">No match. Remove it to start with an empty field.</p>
          )}
          {editable && !converted && <p className="text-mnml-danger">That doesn't fit a {TYPE_NAME[m.type]} field.</p>}
          {m.note && <p className="text-mnml-text-soft">{m.note}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {m.suggestion && (
          <Button type="button" size="sm" disabled={!converted} onClick={() => converted && resolve(m.path, converted)}>
            Use this
          </Button>
        )}
        <Button type="button" size="sm" variant={m.suggestion ? 'outline' : 'default'} onClick={() => resolve(m.path)}>
          Remove
        </Button>
      </div>
    </section>
  );
}

/** At the top of the entry: how many fields need a decision, and where. */
export function MismatchBanner({ items, version }: { items: Mismatch[]; version: string }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-[8px] border border-mnml-danger/40 bg-mnml-danger/5 px-4 py-3">
      <p className="flex items-center gap-2 font-medium text-mnml-text">
        <TriangleAlertIcon className="size-4 shrink-0 text-mnml-danger" />
        {items.length === 1 ? '1 field' : `${items.length} fields`} in the {version} no longer {items.length === 1 ? 'matches' : 'match'} the schema
      </p>
      <p className="text-mnml-text-soft">The stored values are kept until you choose. Nothing is saved until every one is settled.</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((m) => (
          <li key={m.path}>
            <button
              type="button"
              className="cursor-pointer text-mnml-text underline underline-offset-2 hover:text-mnml-primary"
              onClick={() => document.getElementById(`mismatch-${m.path}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
