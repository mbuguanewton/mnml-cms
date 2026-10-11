import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';

// The building blocks for a cms.config.ts. One definition there drives the admin forms,
// the validation below, and the TypeScript types the readers return.

type Base = { label: string; required?: boolean; help?: string };

export type TextField = Base & { type: 'text' };
export type TextareaField = Base & { type: 'textarea' };
export type DateField = Base & { type: 'date' };
export type UrlField = Base & { type: 'url' };
export type ImageField = Base & { type: 'image' };
export type RichTextField = Base & { type: 'richtext' };
export type TagsField = Base & { type: 'tags' };
/** A repeatable group of fields. `itemLabel` names the field shown as each row's title in the admin. */
export type ArrayField<F extends Fields = Fields> = Base & { type: 'array'; fields: F; itemLabel?: keyof F & string };

export type Field = TextField | TextareaField | DateField | UrlField | ImageField | RichTextField | TagsField | ArrayField;
// An interface (not a Record alias) so Field and Fields can reference each other.
export interface Fields {
  [key: string]: Field;
}

type ValueOf<F> = F extends TextField | TextareaField
  ? string
  : F extends DateField | UrlField | ImageField
    ? string | null
    : F extends RichTextField
      ? JSONContent
      : F extends TagsField
        ? string[]
        : F extends ArrayField<infer S>
          ? EntryOf<S>[]
          : never;

export type EntryOf<F extends Fields> = { [K in keyof F]: ValueOf<F[K]> };

type Opts = Omit<Base, 'label'>;

export const fields = {
  text: (label: string, o: Opts = {}): TextField => ({ type: 'text', label, ...o }),
  textarea: (label: string, o: Opts = {}): TextareaField => ({ type: 'textarea', label, ...o }),
  date: (label: string, o: Opts = {}): DateField => ({ type: 'date', label, ...o }),
  url: (label: string, o: Opts = {}): UrlField => ({ type: 'url', label, ...o }),
  image: (label: string, o: Opts = {}): ImageField => ({ type: 'image', label, ...o }),
  richtext: (label: string, o: Opts = {}): RichTextField => ({ type: 'richtext', label, ...o }),
  tags: (label: string, o: Opts = {}): TagsField => ({ type: 'tags', label, ...o }),
  array: <F extends Fields>(label: string, fields: F, o: Opts & { itemLabel?: NoInfer<keyof F & string> } = {}): ArrayField<F> => ({
    type: 'array',
    label,
    fields,
    ...o,
  }),
};

/**
 * One entry, e.g. site settings. `preview` is the public path to show next to the editor
 * (e.g. '/'); leave it out to turn the live preview off.
 */
export type Singleton<F extends Fields = Fields> = { kind: 'singleton'; label: string; preview?: string; fields: F };

/**
 * Many entries. Each is keyed by a slug made from `titleField` when it is created (then locked),
 * and served on the site at `basePath/<slug>`. `preview: true` shows that page next to the editor.
 */
export type Collection<F extends Fields = Fields> = {
  kind: 'collection';
  label: string;
  titleField: keyof F & string;
  basePath: string;
  preview?: boolean;
  fields: F;
};

export const singleton = <F extends Fields>(s: Omit<Singleton<F>, 'kind'>): Singleton<F> => ({ kind: 'singleton', ...s });
export const collection = <F extends Fields>(c: Omit<Collection<F>, 'kind' | 'titleField'> & { titleField: NoInfer<keyof F & string> }): Collection<F> => ({
  kind: 'collection',
  ...c,
});

export type CmsConfig = Record<string, Singleton | Collection>;

/** Identity helper so cms.config.ts gets checked and keeps its exact types. */
export const config = <C extends CmsConfig>(c: C) => c;

export type SingletonKey<C extends CmsConfig> = { [K in keyof C]: C[K] extends { kind: 'singleton' } ? K : never }[keyof C] & string;
export type CollectionKey<C extends CmsConfig> = { [K in keyof C]: C[K] extends { kind: 'collection' } ? K : never }[keyof C] & string;
export type EntryFor<C extends CmsConfig, K extends keyof C> = EntryOf<C[K]['fields']>;

/** The public path to preview an entry on, or null if preview is off for it. */
export function previewPath(def: Singleton | Collection, slug?: string): string | null {
  if (def.kind === 'singleton') return def.preview ?? null;
  return def.preview && slug ? `${def.basePath}/${slug}` : null;
}

export const emptyDoc: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function emptyValue(f: Field): unknown {
  switch (f.type) {
    case 'text':
    case 'textarea':
      return '';
    case 'date':
    case 'url':
    case 'image':
      return null;
    case 'richtext':
      return emptyDoc;
    case 'tags':
    case 'array':
      return [];
  }
}

// Fill in fields missing from stored data (e.g. a field added after the entry was saved).
export function withDefaults<F extends Fields>(fields: F, data: unknown): EntryOf<F> {
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(fields)) {
    const v = src[k];
    if (v === undefined) out[k] = emptyValue(f);
    else if (f.type === 'array' && Array.isArray(v)) out[k] = v.map((item) => withDefaults(f.fields, item));
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
      const s = z.string().refine((v) => v.startsWith('/') || v.startsWith('https://'), 'Invalid image');
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
  }
}

export function objectSchema(fields: Fields) {
  return z.strictObject(Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, fieldSchema(f)])));
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
