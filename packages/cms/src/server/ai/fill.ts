import { markdownFields } from '../../rich-text/markdown.js';
import type { Collection, Singleton } from '../../schema/define.js';
import { validate } from '../content/content.js';
import type { Context } from '../context.js';
import { unknownFields } from '../mcp/schema.js';

/** What the assistant may put in the form: the fields that passed, and why the others were left out. */
export type Fill = { values: Record<string, unknown>; dropped: Record<string, string> };

/**
 * Checks an agent's values for an entry the way a save does, one top-level field at a time, and keeps only the
 * ones that fit. Rich text may be Markdown. Problems elsewhere in the form (a required field still empty) don't
 * count against a field: only errors under its own path do.
 */
export function checkFill(ctx: Context, key: string, slug: string | undefined, current: unknown, patch: unknown): Fill {
  const def = ctx.config[key] as Singleton | Collection;
  const values: Record<string, unknown> = {};
  const dropped: Record<string, string> = {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { values, dropped: { $data: 'Expected an object of fields.' } };

  for (const path of unknownFields(def.fields, patch)) dropped[path] = 'Not a field of this entry.';
  const known = Object.fromEntries(Object.entries(patch).filter(([k]) => Object.hasOwn(def.fields, k)));

  const md = markdownFields(def.fields, known);
  Object.assign(dropped, md.errors);
  const base = current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>) : {};

  for (const [k, v] of Object.entries(md.data as Record<string, unknown>)) {
    if (Object.keys(md.errors).some((p) => p === k || p.startsWith(`${k}.`))) continue;
    const result = validate(ctx, { key, slug: slug ?? 'assistant', data: { ...base, [k]: v } });
    const own = result.ok ? undefined : Object.entries(result.errors).find(([p]) => p === k || p.startsWith(`${k}.`));
    if (own) dropped[own[0]] = own[1];
    else values[k] = v;
  }
  return { values, dropped };
}
