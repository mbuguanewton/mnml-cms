import type { JSONContent } from '@tiptap/core';
import { normalizeDatetime } from './datetime.js';
import { emptyValue, isVisible, type Field, type Fields } from './define.js';

// Stored content outlives the config. Change a field (rich text to text, a `select` option removed) and entries still
// hold values of the old kind. This module finds those values, offers a conversion, and gives readers and the admin
// a version of the entry that always fits, so nothing crashes on a stale value. Pure: no React, no server code.

/** A stored value that does not fit its field. `path` is the form path (`footer.links.0.label`). */
export type Mismatch = {
  path: string;
  label: string;
  type: Field['type'];
  /** What is stored. */
  stored: unknown;
  /** A value that fits the field and says the same thing, when there is one. */
  suggestion?: { value: unknown };
  /** What the suggestion loses, in a few words ("1 heading, a list"), when it loses something. */
  note?: string;
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const isDoc = (v: unknown): v is JSONContent => isObject(v) && v.type === 'doc';

// ---- Rich text and text ---------------------------------------------------------------------------------------------

// Nodes whose children are blocks (joined by a line or a blank line); everything else holds inline text.
const BLOCK_PARENTS = new Set(['doc', 'blockquote', 'detailsContent']);
const LINE_PARENTS = new Set(['bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem', 'table', 'tableRow']);

/** The words of a rich text document as plain text: a blank line between blocks, a line for each list item. */
export function docToText(doc: JSONContent | null | undefined): string {
  const walk = (node: JSONContent): string => {
    if (typeof node.text === 'string') return node.text;
    if (node.type === 'hardBreak') return '\n';
    const kids = (node.content ?? []).map(walk);
    if (node.type === 'tableCell' || node.type === 'tableHeader') return kids.join(' ');
    if (node.type && BLOCK_PARENTS.has(node.type)) return kids.join('\n\n');
    if (node.type && LINE_PARENTS.has(node.type)) return kids.join('\n');
    return kids.join('');
  };
  return doc
    ? walk(doc)
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';
}

/** Plain text as a rich text document: one paragraph for each line. */
export function docFromText(text: string): JSONContent {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { type: 'doc', content: lines.length ? lines.map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })) : [{ type: 'paragraph' }] };
}

/** A stored value as text, when it has a sensible one: text, numbers, rich text, a list of words. */
function storedText(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return String(v);
  if (isDoc(v)) return docToText(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.join(', ');
  return null;
}

// ---- Does a value fit? ----------------------------------------------------------------------------------------------

const isDateText = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Whether a stored value has the right shape for a field. Not the field's rules (required, min, max): the kind of value. */
function fitsLeaf(f: Field, v: unknown): boolean {
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'url':
    case 'reference':
      return typeof v === 'string';
    case 'date':
      return isDateText(v);
    case 'datetime':
      return typeof v === 'string' && normalizeDatetime(v) !== null;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'select':
      return typeof v === 'string' && f.options.includes(v);
    case 'richtext':
      return isDoc(v);
    case 'tags':
    case 'references':
      return isStrings(v);
    // An image used to be stored as a bare URL string, and still reads fine.
    case 'image':
      return typeof v === 'string' || (isObject(v) && typeof v.url === 'string');
    default:
      return true;
  }
}

type Found = (m: Mismatch) => void;

/** One value, made to fit: missing and empty values become the field's empty value, a misfit one is reported and emptied. */
function fitValue(f: Field, v: unknown, path: string, found: Found): unknown {
  if (isEmpty(v)) return emptyValue(f);
  const misfit = () => {
    const suggestion = convertValue(f, v);
    const note = suggestion ? lossNote(f, v) : null;
    found({ path, label: f.label, type: f.type, stored: v, ...(suggestion && { suggestion }), ...(note && { note }) });
    return emptyValue(f);
  };
  switch (f.type) {
    case 'group':
      return isObject(v) ? fitFields(f.fields, v, path, found) : misfit();
    case 'array':
      return Array.isArray(v) && v.every(isObject) ? v.map((item, i) => fitFields(f.fields, item, `${path}.${i}`, found)) : misfit();
    case 'blocks':
      if (!Array.isArray(v)) return misfit();
      // A block whose kind is no longer in the config is dropped, so a row's index is its place in what is kept.
      return v
        .filter((item) => isObject(item) && typeof item.kind === 'string' && Object.hasOwn(f.blocks, item.kind))
        .map((item, i) => {
          const { kind } = item as { kind: string };
          return { kind, ...fitFields(f.blocks[kind].fields, item as Record<string, unknown>, `${path}.${i}`, found) };
        });
    case 'image':
      return fitsLeaf(f, v) ? (typeof v === 'string' ? { url: v, alt: '' } : v) : misfit();
    default:
      return fitsLeaf(f, v) ? v : misfit();
  }
}

function fitFields(fields: Fields, data: Record<string, unknown>, prefix: string, found: Found): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${k}` : k;
    // A hidden field keeps its value, so it can't be fixed (or even seen): its misfit is dropped quietly, as saving does.
    out[k] = fitValue(f, data[k], path, isVisible(f, data) ? found : () => {});
  }
  return out;
}

/**
 * The entry's data with every value made to fit its field (what `withDefaults` does, plus: a value of the wrong kind
 * is replaced by the field's empty value). Calls `onMisfit` for each one. Valid data comes back the same as `withDefaults` gives.
 */
export function fitDefaults(fields: Fields, data: unknown, onMisfit?: (m: Mismatch) => void): Record<string, unknown> {
  return fitFields(fields, isObject(data) ? data : {}, '', onMisfit ?? (() => {}));
}

/** The data a form can safely show, and the values that were set aside because they don't fit. */
export function reviewEntry(fields: Fields, data: unknown): { data: Record<string, unknown>; mismatches: Mismatch[] } {
  const mismatches: Mismatch[] = [];
  const fitted = fitDefaults(fields, data, (m) => mismatches.push(m));
  return { data: fitted, mismatches };
}

// ---- Conversion -----------------------------------------------------------------------------------------------------

const YES = new Set(['yes', 'y', 'true', '1', 'on']);
const NO = new Set(['no', 'n', 'false', '0', 'off']);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
// A number is a time only if it looks like one: seconds (2001 to 5138) or milliseconds since 1970. `42` and `2025` aren't.
const asEpoch = (n: number) => (Math.abs(n) >= 1e11 ? n : n >= 1e9 && n < 1e11 ? n * 1000 : NaN);
const asDate = (v: unknown): Date | null => {
  const d = typeof v === 'number' ? new Date(asEpoch(v)) : typeof v === 'string' && v.trim() ? new Date(v.trim()) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const asUrl = (text: string): string | null => {
  const ok = (u: string) => {
    try {
      return ['http:', 'https:', 'mailto:'].includes(new URL(u).protocol);
    } catch {
      return false;
    }
  };
  const t = text.trim();
  if (ok(t)) return t;
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) && ok(`https://${t}`) ? `https://${t}` : null;
};
const words = (text: string) => [
  ...new Set(
    text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

/**
 * A value for `field` that says the same as `stored`, or null when there is no sensible one (then the editor can only
 * remove it). Rich text to text, text to rich text, text and numbers, yes/no to a checkbox, text to a `select` option
 * (by value or label), dates, links, and comma lists to tags or entries.
 */
export function convertValue(field: Field, stored: unknown): { value: unknown } | null {
  const text = storedText(stored);
  if (text === null || text.trim() === '') return null;
  const t = text.trim();
  const out = (value: unknown) => ({ value });
  switch (field.type) {
    case 'text':
      return out(t.replace(/\s*\n+\s*/g, ' '));
    case 'textarea':
      return out(t);
    case 'richtext':
      return isDoc(stored) ? null : out(docFromText(t));
    case 'number': {
      const n = Number(t.replace(/,/g, ''));
      return Number.isFinite(n) ? out(n) : null;
    }
    case 'boolean':
      return YES.has(t.toLowerCase()) ? out(true) : NO.has(t.toLowerCase()) ? out(false) : null;
    case 'select': {
      const low = t.toLowerCase();
      const hit = field.options.find((o) => o.toLowerCase() === low || field.optionLabels?.[o]?.toLowerCase() === low);
      return hit === undefined ? null : out(hit);
    }
    case 'date': {
      const d = asDate(typeof stored === 'number' ? stored : /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(0, 10)}T00:00:00Z` : t);
      return d ? out(isoDay(d)) : null;
    }
    case 'datetime': {
      const iso = typeof stored === 'string' ? normalizeDatetime(t) : null;
      const d = iso ? new Date(iso) : asDate(typeof stored === 'number' ? stored : t);
      return d ? out(d.toISOString()) : null;
    }
    case 'url': {
      const u = asUrl(t);
      return u ? out(u) : null;
    }
    case 'reference':
      return /^\S+$/.test(t) ? out(t) : null;
    case 'tags':
    case 'references': {
      const list = Array.isArray(stored) ? stored.map(String).filter(Boolean) : words(t);
      return list.length ? out(list) : null;
    }
    default:
      return null;
  }
}

/** What a rich text document has that plain text can't keep: headings, lists, links, styling… */
export function docLoss(doc: JSONContent): string[] {
  const n = { heading: 0, list: 0, link: 0, styled: 0, quote: 0, code: 0, table: 0, image: 0, other: 0 };
  const walk = (node: JSONContent) => {
    for (const m of node.marks ?? []) {
      if (m.type === 'link') n.link++;
      else if (typeof node.text === 'string') n.styled++;
    }
    switch (node.type) {
      case 'heading':
        n.heading++;
        break;
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        n.list++;
        break;
      case 'blockquote':
        n.quote++;
        break;
      case 'codeBlock':
        n.code++;
        break;
      case 'table':
        n.table++;
        break;
      case 'image':
        n.image++;
        break;
      case 'doc':
      case 'paragraph':
      case 'text':
      case 'hardBreak':
      case 'listItem':
      case 'taskItem':
      case 'tableRow':
      case 'tableCell':
      case 'tableHeader':
        break;
      default:
        n.other++;
    }
    for (const c of node.content ?? []) walk(c);
  };
  walk(doc);
  const many = (c: number, one: string, more = `${one}s`) => (c === 1 ? `1 ${one}` : `${c} ${more}`);
  return [
    n.heading && many(n.heading, 'heading'),
    n.list && many(n.list, 'list'),
    n.link && many(n.link, 'link'),
    n.styled && 'bold, italic or other styling',
    n.quote && many(n.quote, 'quote'),
    n.code && many(n.code, 'code block'),
    n.table && many(n.table, 'table'),
    n.image && many(n.image, 'image'),
    n.other && many(n.other, 'embedded block'),
  ].filter((x): x is string => !!x);
}

/** What converting `stored` for `field` loses, in a sentence, or null when nothing is lost. */
export function lossNote(field: Field, stored: unknown): string | null {
  if (isDoc(stored) && (field.type === 'text' || field.type === 'textarea')) {
    const lost = docLoss(stored);
    const blocks = (stored.content ?? []).length;
    const parts = [
      ...(lost.length ? [`Lost: ${lost.join(', ')}.`] : []),
      ...(field.type === 'text' && blocks > 1 ? ['Paragraphs are joined on one line.'] : []),
    ];
    return parts.length ? parts.join(' ') : null;
  }
  if (field.type === 'date' && typeof stored === 'string' && /T\d{2}:\d{2}/.test(stored)) return 'The time of day is dropped.';
  return null;
}

// ---- Paths ----------------------------------------------------------------------------------------------------------

/** `data` with the value at a form path (`sections.0.title`) set, without changing `data`. */
export function setIn(data: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split('.');
  const next = rest.join('.');
  if (Array.isArray(data)) {
    const copy = [...data];
    copy[Number(head)] = rest.length ? setIn(copy[Number(head)], next, value) : value;
    return copy;
  }
  const obj = isObject(data) ? data : {};
  return { ...obj, [head]: rest.length ? setIn(obj[head], next, value) : value };
}

/**
 * The field at a form path (`footer.links.0.label`), or undefined. Block rows can have different fields for each kind:
 * pass the entry's `data` so the row's own kind is used (without it, the fields of every kind are merged).
 */
export function fieldAt(fields: Fields, path: string, data?: unknown): Field | undefined {
  let current: Fields | null = fields;
  let found: Field | undefined;
  let node: unknown = data;
  for (const part of path.split('.')) {
    if (/^\d+$/.test(part)) {
      node = Array.isArray(node) ? node[Number(part)] : undefined;
      if (found?.type === 'blocks') {
        const kind = isObject(node) && typeof node.kind === 'string' ? node.kind : '';
        current = Object.hasOwn(found.blocks, kind) ? found.blocks[kind].fields : Object.assign({}, ...Object.values(found.blocks).map((b) => b.fields));
      }
      continue;
    }
    const f: Field | undefined = current && Object.hasOwn(current, part) ? current[part] : undefined;
    if (!f) return undefined;
    found = f;
    node = isObject(node) ? node[part] : undefined;
    if (f.type === 'group' || f.type === 'array') current = f.fields;
    else current = null;
  }
  return found;
}

/** The label of the field at a form path (`footer.links.0.label` gives "Label"), or the path if there is none. */
export const fieldLabelAt = (fields: Fields, path: string, data?: unknown): string => fieldAt(fields, path, data)?.label ?? path;
