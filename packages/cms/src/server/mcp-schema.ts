import type { Collection, Field, Fields, Singleton } from '../define.js';

// The content model as JSON Schema, for agents: what `get_schema` returns and what `create_entry` and
// `update_entry` accept. Generated from the config, so select options and limits always match it.

type Json = Record<string, unknown>;

const nullable = (s: Json): Json => ({ anyOf: [s, { type: 'null' }] });
const limits = (f: { min?: number; max?: number; required?: boolean }): Json => {
  const min = Math.max(f.min ?? 0, f.required ? 1 : 0);
  return { ...(min > 0 && { minItems: min }), ...(f.max !== undefined && { maxItems: f.max }) };
};

const RICH_TEXT =
  'Markdown (easiest): headings, **bold**, *italic*, ~~strike~~, `code`, links, lists, > quotes, code blocks, images, ---. No tables or raw HTML. ' +
  'Or Tiptap JSON {"type":"doc","content":[...]}, needed for tables, entry references and the site\'s own nodes.';

function describe(f: Field, extra?: string): string | undefined {
  const parts = [f.help, extra, f.showIf && `Only used while ${JSON.stringify(f.showIf)} (sibling fields).`].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

export function fieldJsonSchema(f: Field): Json {
  const base = (s: Json, extra?: string): Json => {
    const description = describe(f, extra);
    return { title: f.label, ...s, ...(description && { description }) };
  };
  switch (f.type) {
    case 'text':
    case 'textarea':
      return base({ type: 'string', ...(f.required && { minLength: 1 }) });
    case 'date':
      return base(f.required ? { type: 'string', format: 'date' } : nullable({ type: 'string', format: 'date' }), 'YYYY-MM-DD.');
    case 'datetime':
      return base(f.required ? { type: 'string', format: 'date-time' } : nullable({ type: 'string', format: 'date-time' }), 'ISO 8601, stored as UTC.');
    case 'url':
      return base(f.required ? { type: 'string', format: 'uri' } : nullable({ type: 'string', format: 'uri' }), 'https://, http:// or mailto:.');
    case 'image': {
      const focal = { type: 'number', minimum: 0, maximum: 1 };
      const image = {
        type: 'object',
        properties: { url: { type: 'string' }, alt: { type: 'string', maxLength: 300 }, focalX: focal, focalY: focal },
        required: ['url', 'alt'],
        additionalProperties: false,
      };
      return base(f.required ? image : nullable(image), 'url from upload_media_from_url. alt describes the image; empty only if decorative.');
    }
    case 'boolean':
      return base({ type: 'boolean' });
    case 'number': {
      const n = { type: 'number', ...(f.min !== undefined && { minimum: f.min }), ...(f.max !== undefined && { maximum: f.max }) };
      return base(f.required ? n : nullable(n));
    }
    case 'select': {
      const labels = f.optionLabels ? `Labels: ${f.options.map((o) => `${o} = ${f.optionLabels?.[o] ?? o}`).join(', ')}.` : undefined;
      return base({ enum: f.required ? [...f.options] : [...f.options, null] }, labels);
    }
    case 'reference': {
      const s = { type: 'string' };
      return base(f.required ? s : nullable(s), `Slug of an entry in "${f.collection}".`);
    }
    case 'references':
      return base({ type: 'array', items: { type: 'string' }, ...limits(f) }, `Slugs of entries in "${f.collection}", in order.`);
    case 'richtext':
      return base(
        {
          anyOf: [
            { type: 'string', description: 'Markdown' },
            { type: 'object', properties: { type: { const: 'doc' } }, required: ['type'] },
          ],
        },
        RICH_TEXT,
      );
    case 'tags':
      return base({ type: 'array', items: { type: 'string', minLength: 1 }, ...limits(f) });
    case 'array':
      return base({ type: 'array', items: objectJsonSchema(f.fields), ...limits(f) });
    case 'group':
      return base(objectJsonSchema(f.fields));
    case 'blocks': {
      const items = Object.entries(f.blocks).map(([kind, b]) => ({
        title: b.label,
        ...(b.description && { description: b.description }),
        ...objectJsonSchema(b.fields, { kind: { const: kind } }),
      }));
      return base({ type: 'array', items: { anyOf: items }, ...limits(f) }, 'Each item is one kind of block, chosen by "kind".');
    }
  }
}

/** An object of fields. Only `required` fields are listed as required: missing ones are filled with their empty value. */
export function objectJsonSchema(fields: Fields, extra: Json = {}): Json {
  const properties: Json = { ...extra };
  for (const [k, f] of Object.entries(fields)) properties[k] = fieldJsonSchema(f);
  const required = [...Object.keys(extra), ...Object.entries(fields).flatMap(([k, f]) => (f.required && f.type !== 'boolean' ? [k] : []))];
  return { type: 'object', properties, ...(required.length && { required }), additionalProperties: false };
}

/** One singleton or collection, as `get_schema` describes it. */
export function describeContent(key: string, def: Singleton | Collection) {
  return {
    key,
    kind: def.kind,
    label: def.label,
    ...(def.kind === 'collection'
      ? { titleField: def.titleField, basePath: def.basePath, slug: 'Made from titleField on create unless given. Lowercase, numbers, dashes. Fixed after.' }
      : { drafts: !!def.drafts, ...(def.preview && { path: def.preview }) }),
    data: objectJsonSchema(def.fields),
  };
}

/** Paths of keys in `data` that aren't fields (they would be dropped silently), e.g. ['subtitel', 'hero.titel']. */
export function unknownFields(fields: Fields, data: unknown, at = ''): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    const f = fields[k];
    const path = at ? `${at}.${k}` : k;
    if (!Object.hasOwn(fields, k)) out.push(path);
    else if (f.type === 'group') out.push(...unknownFields(f.fields, v, path));
    else if (f.type === 'array' && Array.isArray(v)) v.forEach((item, i) => out.push(...unknownFields(f.fields, item, `${path}.${i}`)));
    else if (f.type === 'blocks' && Array.isArray(v))
      v.forEach((item, i) => {
        const kind = (item as { kind?: unknown } | null)?.kind;
        if (typeof kind !== 'string' || !Object.hasOwn(f.blocks, kind)) out.push(`${path}.${i}.kind`);
        else {
          const rest = Object.fromEntries(Object.entries(item as object).filter(([key]) => key !== 'kind'));
          out.push(...unknownFields(f.blocks[kind].fields, rest, `${path}.${i}`));
        }
      });
  }
  return out;
}
