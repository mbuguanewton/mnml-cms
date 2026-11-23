// Filters, sortable columns and the URL for the admin's collection list. Pure and in memory, like `listView`.
import type { EntryStatus } from '../../api.js';
import type { Collection, Field } from '../../schema/define.js';
import { COLUMN_TYPES, FILTER_TYPES } from '../../schema/list-config.js';
import { displayText } from '../../schema/text.js';

export type ListItem = { slug: string; entry: Record<string, unknown>; status: EntryStatus };

// ── Filters ─────────────────────────────────────────────────────────────────

export type FilterSpec = { name: string; label: string; field: Field };
/** What a row's status cell shows: a draft, a published entry with unpublished changes, or published. */
export type ListStatus = 'draft' | 'changes' | 'published';
export const LIST_STATUSES: readonly ListStatus[] = ['draft', 'changes', 'published'];
/** `eq` for select, boolean (`yes` / `no`) and reference; `from` / `to` for date, datetime and number (min / max). */
export type FieldFilter = { eq?: string; from?: string; to?: string };
export type ListFilters = { status?: ListStatus; fields: Record<string, FieldFilter> };

/** The filters a collection offers: its `filters` option (in that order), or every field that can be filtered. */
export function filterSpecs(def: Collection): FilterSpec[] {
  if (def.filters === false) return [];
  const names = def.filters ?? Object.keys(def.fields).filter((k) => FILTER_TYPES.has(def.fields[k].type));
  return names.filter((n) => Object.hasOwn(def.fields, n)).map((name) => ({ name, label: def.fields[name].label, field: def.fields[name] }));
}

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const number = (v: string | undefined) => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? v.trim() : undefined);

/** The URL parameter(s) of a filter: `f.<name>`, or `.from` / `.to` (date, datetime) and `.min` / `.max` (number). */
export const filterParams = (s: FilterSpec): { eq: string; from: string; to: string } => {
  const base = `f.${s.name}`;
  return s.field.type === 'number' ? { eq: base, from: `${base}.min`, to: `${base}.max` } : { eq: base, from: `${base}.from`, to: `${base}.to` };
};

/** Reads the filters from the URL. Anything unknown or malformed is ignored, so a stale or edited link never errors. */
export function parseFilters(query: Query, specs: readonly FilterSpec[]): ListFilters {
  const status = first(query.status);
  const out: ListFilters = { fields: {} };
  if (LIST_STATUSES.includes(status as ListStatus)) out.status = status as ListStatus;
  for (const s of specs) {
    const p = filterParams(s);
    const f: FieldFilter = {};
    const type = s.field.type;
    if (type === 'select') {
      const v = first(query[p.eq]);
      if (v !== undefined && s.field.type === 'select' && s.field.options.includes(v)) f.eq = v;
    } else if (type === 'boolean') {
      const v = first(query[p.eq]);
      if (v === 'yes' || v === 'no') f.eq = v;
    } else if (type === 'reference') {
      const v = first(query[p.eq]);
      if (v && v.length <= 200) f.eq = v;
    } else if (type === 'date' || type === 'datetime') {
      const [from, to] = [first(query[p.from]), first(query[p.to])];
      if (from && DAY.test(from)) f.from = from;
      if (to && DAY.test(to)) f.to = to;
    } else if (type === 'number') {
      f.from = number(first(query[p.from]));
      f.to = number(first(query[p.to]));
    }
    if (f.eq !== undefined || f.from !== undefined || f.to !== undefined)
      out.fields[s.name] = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
  }
  return out;
}

/** The set filters as URL parameter → value, for the filter controls. */
export function filterValues(filters: ListFilters, specs: readonly FilterSpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.status) out.status = filters.status;
  for (const s of specs) {
    const f = filters.fields[s.name];
    const p = filterParams(s);
    if (f?.eq !== undefined) out[p.eq] = f.eq;
    if (f?.from !== undefined) out[p.from] = f.from;
    if (f?.to !== undefined) out[p.to] = f.to;
  }
  return out;
}

/** How many filters are set (status counts). */
export const activeCount = (f: ListFilters) =>
  (f.status ? 1 : 0) +
  Object.values(f.fields).reduce((n, v) => n + (v.eq !== undefined ? 1 : 0) + (v.from !== undefined ? 1 : 0) + (v.to !== undefined ? 1 : 0), 0);

const statusOf = (item: ListItem, pending: ReadonlySet<string>): ListStatus =>
  item.status === 'draft' ? 'draft' : pending.has(item.slug) ? 'changes' : 'published';

const day = (v: unknown) => displayText(v).slice(0, 10);

function matches(item: ListItem, s: FilterSpec, f: FieldFilter): boolean {
  const v = item.entry[s.name];
  switch (s.field.type) {
    case 'select':
    case 'reference':
      return f.eq === undefined || v === f.eq;
    case 'boolean':
      return f.eq === undefined || (f.eq === 'yes' ? v === true : v !== true);
    case 'date':
    case 'datetime': {
      if (f.from === undefined && f.to === undefined) return true;
      const d = day(v);
      // An entry with no date can't be in a date range. A datetime's day is its UTC day.
      return d !== '' && (f.from === undefined || d >= f.from) && (f.to === undefined || d <= f.to);
    }
    case 'number': {
      if (f.from === undefined && f.to === undefined) return true;
      return typeof v === 'number' && (f.from === undefined || v >= Number(f.from)) && (f.to === undefined || v <= Number(f.to));
    }
    default:
      return true;
  }
}

/** Keeps the entries that match every set filter. */
export function applyFilters<T extends ListItem>(items: T[], filters: ListFilters, specs: readonly FilterSpec[], pending: ReadonlySet<string>): T[] {
  const active = specs.filter((s) => filters.fields[s.name]);
  if (!filters.status && !active.length) return items;
  return items.filter((i) => (!filters.status || statusOf(i, pending) === filters.status) && active.every((s) => matches(i, s, filters.fields[s.name])));
}

// ── Columns and sorting ─────────────────────────────────────────────────────

/** `slug`, `status`, or `f.<field>`. */
export type Column = { key: string; label: string; field?: Field };
export type Sort = { key: string; dir: 'asc' | 'desc' };

/** The table's columns: the first field (the link), Slug, Status, then the other fields. Default fields: the title and the first date. */
export function columnSpecs(def: Collection): Column[] {
  const dateField = Object.entries(def.fields).find(([, f]) => f.type === 'date')?.[0];
  const names = (def.columns?.length ? [...def.columns] : [def.titleField, ...(dateField && dateField !== def.titleField ? [dateField] : [])]).filter((n) =>
    Object.hasOwn(def.fields, n),
  );
  const fieldCols = names.map((n): Column => ({ key: `f.${n}`, label: def.fields[n].label, field: def.fields[n] }));
  return [...fieldCols.slice(0, 1), { key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status' }, ...fieldCols.slice(1)];
}

// ── Column choices (the Columns menu) ───────────────────────────────────────

/** The cookie holding an editor's visible columns for a collection. */
export const columnCookie = (key: string) => `mnml_cols_${key}`;

/**
 * The columns an editor may show or hide: Slug, Status, then the fields (see `columnChoices`): the ones the table shows
 * by default in their order first, then the rest in config order, so hiding one never reshuffles the others. The first
 * default column is not one of them: it always shows.
 */
export function columnChoices(def: Collection): Column[] {
  if (def.columnChoices === false) return [];
  const defaults = columnSpecs(def);
  const primary = defaults[0]?.key;
  const allowed = new Set(def.columnChoices ?? Object.keys(def.fields).filter((k) => COLUMN_TYPES.has(def.fields[k].type)));
  const byDefault = defaults.filter((c) => c.field && c.key !== primary).map((c) => c.key.slice(2));
  const names = [...new Set([...byDefault, ...Object.keys(def.fields)])].filter((k) => allowed.has(k) && `f.${k}` !== primary);
  const fieldCols = names.map((k): Column => ({ key: `f.${k}`, label: def.fields[k].label, field: def.fields[k] }));
  return [{ key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status' }, ...fieldCols];
}

const COLUMN_KEY = /^(slug|status|f\.[\w-]+)$/;

/** Reads the cookie: the chosen column keys (`-` is none), or undefined when there is none or it is junk. */
export function parseColumnCookie(value: string | undefined): Set<string> | undefined {
  if (value === undefined) return undefined;
  if (value === '-') return new Set();
  const keys = value
    .split(',')
    .slice(0, 64)
    .filter((k) => COLUMN_KEY.test(k));
  return keys.length ? new Set(keys) : undefined;
}

/** The cookie value for these visible column keys. */
export const serializeColumns = (keys: readonly string[]) => (keys.length ? keys.join(',') : '-');

/**
 * The columns to show: the editor's choice (the first column, then the chosen ones in the order Slug, Status, fields),
 * or `columnSpecs` when they haven't chosen, or the developer turned the choice off with `columnChoices: false`.
 * Keys that aren't a choice are ignored.
 */
export function visibleColumns(def: Collection, cookie: string | undefined): Column[] {
  const defaults = columnSpecs(def);
  const chosen = def.columnChoices === false ? undefined : parseColumnCookie(cookie);
  if (!chosen) return defaults;
  return [defaults[0], ...columnChoices(def).filter((c) => chosen.has(c.key))];
}

/** Reads `?sort=&dir=`. An unknown column is ignored; `dir` is `asc` unless `desc`. */
export function parseSort(query: Query, columns: readonly Column[]): Sort | undefined {
  const key = first(query.sort);
  if (!key || !columns.some((c) => c.key === key)) return undefined;
  return { key, dir: first(query.dir) === 'desc' ? 'desc' : 'asc' };
}

/** What a click on a column header does: ascending, then descending, then back to the default order. */
export const nextSort = (current: Sort | undefined, key: string): Sort | undefined =>
  current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : undefined;

export type CellCtx = { pending: ReadonlySet<string>; refLabel: (collection: string, slug: string) => string };

const optionLabel = (f: Field, v: unknown) => (f.type === 'select' && typeof v === 'string' ? (f.optionLabels?.[v] ?? v) : displayText(v));

/** A cell as text; '' when empty. */
export function cellText(item: ListItem, col: Column, ctx: CellCtx): string {
  if (col.key === 'slug') return item.slug;
  if (col.key === 'status') return statusOf(item, ctx.pending);
  const f = col.field!;
  const v = item.entry[col.key.slice(2)];
  switch (f.type) {
    case 'boolean':
      return v === true ? 'Yes' : 'No';
    case 'select':
      return optionLabel(f, v);
    case 'reference':
      return typeof v === 'string' && v ? ctx.refLabel(f.collection, v) : '';
    case 'datetime': {
      const t = displayText(v);
      return t ? `${t.slice(0, 10)} ${t.slice(11, 16)} UTC`.trim() : '';
    }
    default:
      return displayText(v);
  }
}

const RANK: Record<ListStatus, number> = { draft: 0, changes: 1, published: 2 };

function sortKey(item: ListItem, col: Column, ctx: CellCtx): string | number | null {
  if (col.key === 'slug') return item.slug;
  if (col.key === 'status') return RANK[statusOf(item, ctx.pending)];
  const f = col.field!;
  const v = item.entry[col.key.slice(2)];
  if (f.type === 'boolean') return v === true ? 1 : 0;
  if (f.type === 'number') return typeof v === 'number' ? v : null;
  const text = f.type === 'select' || f.type === 'reference' ? cellText(item, col, ctx) : displayText(v);
  return text === '' ? null : text;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Sorts by a column. Empty values go last either way, and equal values keep their order. Returns a new array. */
export function sortItems<T extends ListItem>(items: T[], sort: Sort | undefined, columns: readonly Column[], ctx: CellCtx): T[] {
  const col = sort && columns.find((c) => c.key === sort.key);
  if (!sort || !col) return items;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return items
    .map((item, i) => ({ item, i, k: sortKey(item, col, ctx) }))
    .sort((a, b) => {
      if (a.k === null || b.k === null) return a.k === b.k ? a.i - b.i : a.k === null ? 1 : -1;
      const c = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : collator.compare(String(a.k), String(b.k));
      return c ? c * dir : a.i - b.i;
    })
    .map((x) => x.item);
}

// ── The URL ─────────────────────────────────────────────────────────────────

export type ListQuery = { q?: string; filters: ListFilters; sort?: Sort; page?: number };

/** `?q=…&status=…&f.…&sort=…&dir=…&page=…` for the list, or '' when nothing is set. */
export function listQuery(state: ListQuery, specs: readonly FilterSpec[]): string {
  const p = new URLSearchParams();
  if (state.q?.trim()) p.set('q', state.q.trim());
  if (state.filters.status) p.set('status', state.filters.status);
  for (const s of specs) {
    const f = state.filters.fields[s.name];
    if (!f) continue;
    const names = filterParams(s);
    if (f.eq !== undefined) p.set(names.eq, f.eq);
    if (f.from !== undefined) p.set(names.from, f.from);
    if (f.to !== undefined) p.set(names.to, f.to);
  }
  if (state.sort) {
    p.set('sort', state.sort.key);
    p.set('dir', state.sort.dir);
  }
  if (state.page && state.page > 1) p.set('page', String(state.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}
