import type { ToolSet } from 'ai';
import { z } from 'zod';
import { richTextFieldsToMarkdown } from '../../rich-text/markdown.js';
import type { ContentService } from '../content/content.js';
import type { Context } from '../context.js';
import { mcpTools, type Agent } from '../mcp/tools.js';
import { checkFill, type Fill } from './fill.js';
import { MAX_RESULT } from './limits.js';
import { cut } from './prompt.js';

// The assistant's tools, as AI SDK tools (plain objects: this file never imports `ai`, only its types).

/** The tools that only read. Nothing here can write, publish or delete. */
const READ_TOOLS = ['get_schema', 'list_entries', 'get_entry', 'search_content', 'search'];
/** Names a site's own tools may not use. */
export const RESERVED = [...READ_TOOLS, 'fill_field', 'fill_entry'];

/**
 * The read tools over the content `keys` (default: everything): search, list entries, get an entry, get the schema.
 * Used by the assistant and by `cms.tools()`.
 */
export function readTools(ctx: Context, content: ContentService, keys = Object.keys(ctx.config)): ToolSet {
  const agent: Agent = { name: 'assistant', scopes: new Set(['read']), keys };
  const out: ToolSet = {};
  for (const t of mcpTools(ctx, content, agent)) {
    if (!READ_TOOLS.includes(t.name) || !agent.scopes.has(t.scope)) continue;
    out[t.name] = {
      description: t.description,
      inputSchema: t.input,
      async execute(args: Record<string, unknown>) {
        // The SDK checks the input before a model's call, but a site may also run these tools itself: check again, which
        // also fills the schema's defaults.
        const parsed = t.input.safeParse(args);
        if (!parsed.success) {
          return { ok: false, message: 'Invalid arguments.', errors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.') || '$', i.message])) };
        }
        try {
          const result = await t.run(parsed.data, { agent, origin: '' });
          const text = JSON.stringify(result);
          // A very long result is cut: it goes into the model's context.
          return text.length > MAX_RESULT ? { ok: result.ok, truncated: true, text: cut(text, MAX_RESULT) } : result;
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      },
    };
  }
  return out;
}

/** What `fill_field` and `fill_entry` work on: the open entry, and where to send what passed. */
export type FillTarget = { key: string; slug?: string; values: unknown; onFill: (fill: Fill) => void };

/**
 * `fill_field` and `fill_entry`. They put values into the editor's form as unsaved edits; each field is checked like
 * a save first. Nothing is saved or published.
 */
export function fillTools(ctx: Context, target: FillTarget): ToolSet {
  const run = (patch: unknown) => {
    const fill = checkFill(ctx, target.key, target.slug, target.values, patch);
    const filled = Object.keys(fill.values);
    if (filled.length) target.onFill(fill);
    return {
      ok: filled.length > 0,
      filled,
      ...(Object.keys(fill.dropped).length && { dropped: fill.dropped }),
      note: "Applied to the editor's form as unsaved edits. Nothing is saved or published.",
    };
  };
  return {
    fill_field: {
      description:
        'Puts a value into one field of the entry the editor has open. It lands in their form as an unsaved edit they can undo; nothing is saved or published. `field` is a top-level field key. Rich text takes Markdown. For a group, array or blocks field pass the whole value.',
      inputSchema: z.object({ field: z.string(), value: z.any().describe("The new value, in the shape the field's schema gives.") }),
      execute: ({ field, value }: { field: string; value: unknown }) => run({ [field]: value }),
    },
    fill_entry: {
      description:
        'Puts values into several fields of the open entry at once (`data` is an object keyed by field). Fields you leave out keep their value. Same rules as fill_field: an unsaved edit, never saved or published.',
      inputSchema: z.object({ data: z.record(z.string(), z.any()) }),
      execute: ({ data }: { data: unknown }) => run(data),
    },
  };
}

/** What the panel says while a tool runs. */
export const statusOf = (name: string) =>
  name === 'search_content' || name === 'search'
    ? 'Searching the content…'
    : name === 'get_schema'
      ? 'Reading the schema…'
      : name === 'list_entries' || name === 'get_entry'
        ? 'Reading entries…'
        : `Using ${name}…`;

/**
 * What `cms.tools()` gives by default: the published content only. Search (by meaning), the schema, and published
 * list and get. No drafts, no unpublished edits: safe to put behind a public chatbot. `readTools` is the admin's set.
 */
export function publishedTools(ctx: Context, content: ContentService, keys = Object.keys(ctx.config)): ToolSet {
  const base = readTools(ctx, content, keys);
  const out: ToolSet = {};
  for (const name of ['get_schema', 'search_content']) if (base[name]) out[name] = base[name];

  const collections = keys.filter((k) => ctx.config[k].kind === 'collection');
  const asText = (key: string, entry: unknown) => richTextFieldsToMarkdown(ctx.config[key].fields, entry).data;
  // Published only, even when this editor happens to be in Draft Mode.
  const published = { drafts: false } as const;
  const failed = (parsed: { error: z.ZodError }) => ({
    ok: false,
    message: 'Invalid arguments.',
    errors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.') || '$', i.message])),
  });

  if (collections.length) {
    const input = z.object({
      collection: z.enum(collections as [string, ...string[]]),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    });
    out.list_entries = {
      description: 'Published entries of a collection: slug, last update and the content.',
      inputSchema: input,
      async execute(args: Record<string, unknown>) {
        const parsed = input.safeParse(args);
        if (!parsed.success) return failed(parsed);
        const { collection, limit, offset } = parsed.data;
        const rows = await ctx.readers.listEntries(collection as never, { ...published, limit, offset, orderBy: 'slug' });
        return { ok: true, entries: rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, entry: asText(collection, r.entry) })) };
      },
    };
  }
  if (keys.length) {
    const input = z.object({ collection: z.enum(keys as [string, ...string[]]), slug: z.string().optional().describe('Not needed for a singleton.') });
    out.get_entry = {
      description: 'One published entry (or singleton) with its content. Unpublished edits are not shown.',
      inputSchema: input,
      async execute(args: Record<string, unknown>) {
        const parsed = input.safeParse(args);
        if (!parsed.success) return failed(parsed);
        const { collection, slug } = parsed.data;
        const entry =
          ctx.config[collection].kind === 'singleton'
            ? await ctx.readers.getSingleton(collection as never, published)
            : slug
              ? await ctx.readers.getEntry(collection as never, slug, published)
              : null;
        return entry
          ? { ok: true, slug, entry: asText(collection, entry) }
          : { ok: false, message: `No published entry${slug ? ` "${slug}"` : ''} in ${collection}.` };
      },
    };
  }
  return out;
}
