import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';

// The building blocks for a mnml.config.ts. One definition there drives the admin forms,
// the validation below, and the TypeScript types the readers return.

type Scalar = string | number | boolean | null;
/**
 * What a sibling field's value must look like: a value (equals), a list (any of), `{ not }`,
 * a comparison (`gt`, `gte`, `lt`, `lte`, numbers only) or `{ empty }` (no value, text or items).
 */
export type Condition =
  Scalar | readonly Scalar[] | { not: Scalar | readonly Scalar[] } | { gt?: number; gte?: number; lt?: number; lte?: number; empty?: boolean };
/** Show a field only while its sibling fields (same entry, group, item or block) match; every key must. */
export type ShowIf = Record<string, Condition>;

type Base = { label: string; required?: boolean; help?: string; showIf?: ShowIf };

export type TextField = Base & { type: 'text' };
export type TextareaField = Base & { type: 'textarea' };
export type DateField = Base & { type: 'date' };
export type UrlField = Base & { type: 'url' };
export type ImageField = Base & { type: 'image' };
export type BooleanField = Base & { type: 'boolean' };
export type NumberField = Base & { type: 'number'; min?: number; max?: number; step?: number };
/** One of a fixed list of values. */
export type SelectField<O extends readonly string[] = readonly string[]> = Base & { type: 'select'; options: O };
/** Points at an entry of another collection; the value is that entry's slug. */
export type ReferenceField = Base & { type: 'reference'; collection: string };
export type RichTextField = Base & { type: 'richtext' };
export type TagsField = Base & { type: 'tags' };
/** A repeatable group of fields. `itemLabel` names the field shown as each row's title in the admin. */
export type ArrayField<F extends Fields = Fields> = Base & { type: 'array'; fields: F; itemLabel?: keyof F & string };

/** Fields stored together under one key, shown as a section of the form: `page.hero.headline`. */
export type GroupField<F extends Fields = Fields> = Base & { type: 'group'; fields: F };

/** One kind of section inside a `blocks` field. Build it with `block()`. */
export type Block<F extends Fields = Fields> = { label: string; fields: F };
/**
 * A list where each item is one of several kinds of block, each with its own fields. Items are stored
 * as `{ kind: 'hero', …fields }`, so reading one narrows by `kind`. `itemLabel` names the field shown as a row's title.
 */
export type BlocksField<B extends Record<string, Block> = Record<string, Block>> = Base & { type: 'blocks'; blocks: B; itemLabel?: string };

export type Field =
  | TextField
  | TextareaField
  | DateField
  | UrlField
  | ImageField
  | BooleanField
  | NumberField
  | SelectField
  | ReferenceField
  | RichTextField
  | TagsField
  | ArrayField
  | GroupField
  | BlocksField;
// An interface (not a Record alias) so Field and Fields can reference each other.
export interface Fields {
  [key: string]: Field;
}

/** An uploaded image and its alt text (leave `alt` empty only for decorative images). */
export type ImageValue = { url: string; alt: string };

type ValueOf<F> = F extends TextField | TextareaField
  ? string
  : F extends DateField | UrlField | ReferenceField
    ? string | null
    : F extends ImageField
      ? ImageValue | null
      : F extends BooleanField
        ? boolean
        : F extends NumberField
          ? number | null
          : F extends SelectField<infer O>
            ? O[number] | null
            : F extends RichTextField
              ? JSONContent
              : F extends TagsField
                ? string[]
                : F extends ArrayField<infer S>
                  ? EntryOf<S>[]
                  : F extends GroupField<infer S>
                    ? EntryOf<S>
                    : F extends BlocksField<infer B>
                      ? { [K in keyof B & string]: { kind: K } & EntryOf<B[K]['fields']> }[keyof B & string][]
                      : never;

export type EntryOf<F extends Fields> = { [K in keyof F]: ValueOf<F[K]> };

type Opts = Omit<Base, 'label'>;

export const block = <F extends Fields>(label: string, fields: F): Block<F> => ({ label, fields });

export type SeoField = GroupField<{ title: TextField; description: TextareaField; image: ImageField }>;

export const fields = {
  text: (label: string, o: Opts = {}): TextField => ({ type: 'text', label, ...o }),
  textarea: (label: string, o: Opts = {}): TextareaField => ({ type: 'textarea', label, ...o }),
  date: (label: string, o: Opts = {}): DateField => ({ type: 'date', label, ...o }),
  url: (label: string, o: Opts = {}): UrlField => ({ type: 'url', label, ...o }),
  image: (label: string, o: Opts = {}): ImageField => ({ type: 'image', label, ...o }),
  richtext: (label: string, o: Opts = {}): RichTextField => ({ type: 'richtext', label, ...o }),
  tags: (label: string, o: Opts = {}): TagsField => ({ type: 'tags', label, ...o }),
  boolean: (label: string, o: Opts = {}): BooleanField => ({ type: 'boolean', label, ...o }),
  number: (label: string, o: Opts & { min?: number; max?: number; step?: number } = {}): NumberField => ({ type: 'number', label, ...o }),
  select: <const O extends readonly string[]>(label: string, options: O, o: Opts = {}): SelectField<O> => ({ type: 'select', label, options, ...o }),
  /** The slug of an entry in `collection` (a key of your config). Only published entries are offered. */
  reference: (label: string, collection: string, o: Opts = {}): ReferenceField => ({ type: 'reference', label, collection, ...o }),
  group: <F extends Fields>(label: string, fields: F, o: Opts = {}): GroupField<F> => ({ type: 'group', label, fields, ...o }),
  /** A ready-made search/social group; read it back with `seoMetadata()`. */
  seo: (label = 'SEO', o: Opts = {}): SeoField => ({
    type: 'group',
    label,
    fields: {
      title: fields.text('Title'),
      description: fields.textarea('Description', { help: 'Shown in search results and link previews. Around 160 characters.' }),
      image: fields.image('Share image'),
    },
    ...o,
  }),
  /** A list of sections, each one of the `blocks` (made with `block()`), keyed by the `kind` stored with it. */
  blocks: <const B extends Record<string, Block>>(label: string, blocks: B, o: Opts & { itemLabel?: string } = {}): BlocksField<B> => {
    if (Object.keys(blocks).length === 0) throw new Error(`"${label}": blocks needs at least one block.`);
    for (const [k, b] of Object.entries(blocks)) {
      if ('kind' in b.fields) throw new Error(`"${label}": block "${k}" has a field named "kind", which is reserved.`);
    }
    return { type: 'blocks', label, blocks, ...o };
  },
  array: <F extends Fields>(label: string, fields: F, o: Opts & { itemLabel?: NoInfer<keyof F & string> } = {}): ArrayField<F> => ({
    type: 'array',
    label,
    fields,
    ...o,
  }),
};

/** Values worked out from an entry's fields on every read: `{ readingTime: (e) => … }`. Never stored or edited. */
type NoDerived = Record<never, never>;
// Method syntax makes the parameter bivariant, so a definition with specific fields still fits `Singleton | Collection`.
type Derive<F extends Fields, R> = { fn(entry: EntryOf<F>): R }['fn'];
type DerivedFns<F extends Fields, D> = { [K in keyof D]: Derive<F, D[K]> };

/**
 * One entry, e.g. site settings. `preview` is the public path to show next to the editor
 * (e.g. '/'); leave it out to turn the live preview off.
 */
export type Singleton<F extends Fields = Fields, D = NoDerived> = {
  kind: 'singleton';
  label: string;
  preview?: string;
  fields: F;
  derived?: DerivedFns<F, D>;
};

/**
 * Many entries. Each is keyed by a slug made from `titleField` when it is created (then locked),
 * and served on the site at `basePath/<slug>`. `preview: true` shows that page next to the editor.
 */
export type Collection<F extends Fields = Fields, D = NoDerived> = {
  kind: 'collection';
  label: string;
  titleField: keyof F & string;
  basePath: string;
  preview?: boolean;
  fields: F;
  derived?: DerivedFns<F, D>;
};

// What the builders accept: plain functions, so each return type is inferred into D.
type DerivedInput<F extends Fields, D> = { derived?: { [K in keyof D]: (entry: EntryOf<F>) => D[K] } };

function checkDerived(label: string, fields: Fields, derived: object | undefined) {
  for (const k of Object.keys(derived ?? {})) {
    if (k in fields) throw new Error(`"${label}": derived value "${k}" has the same name as a field.`);
  }
}

// A showIf naming a field that isn't a sibling would silently never match, so fail when the config loads.
function checkShowIf(label: string, fields: Fields) {
  for (const [k, f] of Object.entries(fields)) {
    for (const dep of Object.keys(f.showIf ?? {})) {
      if (dep === k) throw new Error(`"${label}": field "${k}" cannot depend on itself in showIf.`);
      if (!(dep in fields)) throw new Error(`"${label}": showIf on "${k}" refers to "${dep}", which is not a field next to it.`);
    }
    if (f.type === 'group' || f.type === 'array') checkShowIf(`${label} › ${k}`, f.fields);
    else if (f.type === 'blocks') for (const [bk, b] of Object.entries(f.blocks)) checkShowIf(`${label} › ${k} › ${bk}`, b.fields);
  }
}

export const singleton = <F extends Fields, D = NoDerived>(s: Omit<Singleton<F, D>, 'kind' | 'derived'> & DerivedInput<F, D>): Singleton<F, D> => {
  checkDerived(s.label, s.fields, s.derived);
  checkShowIf(s.label, s.fields);
  return { kind: 'singleton', ...s };
};
export const collection = <F extends Fields, D = NoDerived>(
  c: Omit<Collection<F, D>, 'kind' | 'titleField' | 'derived'> & { titleField: NoInfer<keyof F & string> } & DerivedInput<F, D>,
): Collection<F, D> => {
  checkDerived(c.label, c.fields, c.derived);
  checkShowIf(c.label, c.fields);
  return { kind: 'collection', ...c };
};

export type CmsConfig = Record<string, Singleton | Collection>;

/** Identity helper so mnml.config.ts gets checked and keeps its exact types. */
export const config = <C extends CmsConfig>(c: C) => c;

export type SingletonKey<C extends CmsConfig> = { [K in keyof C]: C[K] extends { kind: 'singleton' } ? K : never }[keyof C] & string;
export type CollectionKey<C extends CmsConfig> = { [K in keyof C]: C[K] extends { kind: 'collection' } ? K : never }[keyof C] & string;
type DerivedValues<T> = T extends { derived?: infer M }
  ? { [K in keyof NonNullable<M>]: NonNullable<M>[K] extends (...args: never[]) => infer R ? R : never }
  : NoDerived;
/** What the readers return: the fields plus the derived values. */
export type EntryFor<C extends CmsConfig, K extends keyof C> = EntryOf<C[K]['fields']> & DerivedValues<C[K]>;

/**
 * Wraps a derived function with how the admin shows it: `after` is the field it appears under
 * (default: the end of the form), `label` its name (default: the key, spaced out).
 *
 *   derived: { readingTime: derive((p) => readingTime(p.content), { after: 'content' }) }
 */
export function derive<E, R>(fn: (entry: E) => R, o: { label?: string; after?: string } = {}): (entry: E) => R {
  return Object.assign((entry: E) => fn(entry), o);
}

/** Adds the derived values to an entry. The functions see the stored fields, not each other. */
export function withDerived<E extends object>(def: Singleton | Collection, entry: E): E {
  if (!def.derived) return entry;
  const out: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
  for (const [k, fn] of Object.entries(def.derived as Record<string, (e: unknown) => unknown>)) out[k] = fn(entry);
  return out as E;
}

/** The definition without its functions, safe to pass to Client Components. */
export function plainDef<T extends Singleton | Collection>(def: T): Omit<T, 'derived'> {
  return Object.fromEntries(Object.entries(def).filter(([k]) => k !== 'derived')) as Omit<T, 'derived'>;
}

/** The public path to preview an entry on, or null if preview is off for it. */
export function previewPath(def: Singleton | Collection, slug?: string): string | null {
  if (def.kind === 'singleton') return def.preview ?? null;
  return def.preview && slug ? `${def.basePath}/${slug}` : null;
}

export const emptyDoc: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

const isEmptyValue = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

function matches(value: unknown, c: Condition): boolean {
  const v = value ?? null;
  if (Array.isArray(c)) return c.includes(v as Scalar);
  if (c !== null && typeof c === 'object') {
    if ('not' in c) return !matches(value, c.not);
    const r = c as { gt?: number; gte?: number; lt?: number; lte?: number; empty?: boolean };
    if (r.empty !== undefined && isEmptyValue(value) !== r.empty) return false;
    const n = typeof value === 'number' ? value : undefined;
    return (
      (r.gt === undefined || (n !== undefined && n > r.gt)) &&
      (r.gte === undefined || (n !== undefined && n >= r.gte)) &&
      (r.lt === undefined || (n !== undefined && n < r.lt)) &&
      (r.lte === undefined || (n !== undefined && n <= r.lte))
    );
  }
  return v === c;
}

/** Whether `f` is shown, given the values of the fields next to it. */
export function isVisible(f: Field, siblings: unknown): boolean {
  if (!f.showIf) return true;
  const src = (siblings && typeof siblings === 'object' ? siblings : {}) as Record<string, unknown>;
  return Object.entries(f.showIf).every(([k, c]) => matches(src[k], c));
}

export function emptyValue(f: Field): unknown {
  switch (f.type) {
    case 'text':
    case 'textarea':
      return '';
    case 'date':
    case 'url':
    case 'image':
    case 'number':
    case 'select':
    case 'reference':
      return null;
    case 'boolean':
      return false;
    case 'richtext':
      return emptyDoc;
    case 'tags':
    case 'array':
    case 'blocks':
      return [];
    case 'group':
      return withDefaults(f.fields, {});
  }
}

/** Stored images used to be a bare URL string; read those as `{ url, alt: '' }`. */
const toImage = (v: unknown) => (typeof v === 'string' ? { url: v, alt: '' } : v);

const isBlockOf = (f: BlocksField, v: unknown): v is { kind: string } =>
  !!v && typeof v === 'object' && typeof (v as { kind?: unknown }).kind === 'string' && Object.hasOwn(f.blocks, (v as { kind: string }).kind);

// Fill in fields missing from stored data (e.g. a field added after the entry was saved).
export function withDefaults<F extends Fields>(fields: F, data: unknown): EntryOf<F> {
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(fields)) {
    const v = src[k];
    if (v === undefined) out[k] = emptyValue(f);
    else if (f.type === 'array' && Array.isArray(v)) out[k] = v.map((item) => withDefaults(f.fields, item));
    // A block whose kind is no longer in the config is dropped.
    else if (f.type === 'blocks' && Array.isArray(v))
      out[k] = v.flatMap((item) => (isBlockOf(f, item) ? [{ kind: item.kind, ...withDefaults(f.blocks[item.kind].fields, item) }] : []));
    else if (f.type === 'group') out[k] = withDefaults(f.fields, v);
    else if (f.type === 'image') out[k] = toImage(v);
    else out[k] = v;
  }
  return out as EntryOf<F>;
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const isSafeUrl = (v: string) => {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

function fieldSchema(f: Field): z.ZodType {
  switch (f.type) {
    case 'text':
    case 'textarea':
      return f.required ? z.string().trim().min(1, 'Required') : z.string().trim();
    case 'date': {
      const s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
      return z.preprocess(blankToNull, f.required ? s : s.nullable());
    }
    case 'url': {
      const s = z.string().trim().refine(isSafeUrl, 'Enter a full URL (https://… or mailto:…)');
      return z.preprocess(blankToNull, f.required ? s : s.nullable());
    }
    case 'image': {
      const s = z.strictObject({
        url: z.string().refine((v) => v.startsWith('/') || v.startsWith('https://'), 'Invalid image'),
        alt: z.string().trim().max(300, 'Keep it under 300 characters'),
      });
      return z.preprocess((v) => toImage(blankToNull(v)), f.required ? s : s.nullable());
    }
    case 'boolean':
      return z.boolean();
    case 'number': {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return z.preprocess(blankToNull, f.required ? n : n.nullable());
    }
    case 'select': {
      const s = z.enum(f.options as unknown as [string, ...string[]]);
      return z.preprocess(blankToNull, f.required ? s : s.nullable());
    }
    case 'reference': {
      const s = z.string().trim().max(100);
      return z.preprocess(blankToNull, f.required ? s : s.nullable());
    }
    case 'richtext':
      return z.looseObject({ type: z.literal('doc') });
    case 'tags': {
      const s = z.array(z.string().trim().min(1));
      return f.required ? s.min(1, 'Add at least one') : s;
    }
    case 'array':
      return z.array(objectSchema(f.fields));
    case 'group':
      return objectSchema(f.fields);
    case 'blocks': {
      const options = Object.entries(f.blocks).map(([kind, b]) => objectOf(b.fields, { kind: z.literal(kind) }));
      const item = z.discriminatedUnion('kind', options as unknown as [(typeof options)[number], ...(typeof options)[number][]]);
      return z.array(item);
    }
  }
}

/** The collections that reference fields (including inside groups and arrays) point at. */
export function referenceTargets(fields: Fields): string[] {
  const out = new Set<string>();
  for (const f of Object.values(fields)) {
    if (f.type === 'reference') out.add(f.collection);
    else if (f.type === 'group' || f.type === 'array') for (const t of referenceTargets(f.fields)) out.add(t);
    else if (f.type === 'blocks') for (const b of Object.values(f.blocks)) for (const t of referenceTargets(b.fields)) out.add(t);
  }
  return [...out];
}

/**
 * Fields with a `showIf` are validated against their siblings: checked only while shown. A hidden one
 * keeps its stored value, unless that value is not valid for the field, which resets it.
 */
function objectOf(fields: Fields, extra: Record<string, z.core.$ZodType> = {}) {
  const conditional = Object.entries(fields).filter(([, f]) => f.showIf);
  const shape: Record<string, z.core.$ZodType> = { ...extra };
  for (const [k, f] of Object.entries(fields)) shape[k] = f.showIf ? z.unknown() : fieldSchema(f);
  const base = z.strictObject(shape);
  if (conditional.length === 0) return base;
  return base
    .superRefine((data, ctx) => {
      for (const [k, f] of conditional) {
        if (!isVisible(f, data)) continue;
        const r = fieldSchema(f).safeParse((data as Record<string, unknown>)[k]);
        if (!r.success) for (const issue of r.error.issues) ctx.addIssue({ code: 'custom', message: issue.message, path: [k, ...issue.path] });
      }
    })
    .transform((data) => {
      const out = data as Record<string, unknown>;
      for (const [k, f] of conditional) {
        const r = fieldSchema(f).safeParse(out[k]);
        out[k] = r.success ? r.data : emptyValue(f);
      }
      return out;
    });
}

export function objectSchema(fields: Fields) {
  return objectOf(fields);
}

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only')
  .max(100)
  .refine((s) => s !== 'new' && s !== 'singleton', 'Reserved slug');

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
