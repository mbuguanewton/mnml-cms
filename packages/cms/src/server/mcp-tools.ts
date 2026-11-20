import 'server-only';
import { z } from 'zod';
import { canonical } from '../canonical.js';
import { initialValues, slugify, withDefaults, type Collection, type Singleton } from '../define.js';
import { mediaImporter } from '../remote-media.js';
import { previewTarget, type ContentService } from './content.js';
import type { AgentScope, Context } from './context.js';
import { describeContent, unknownFields } from './mcp-schema.js';
import { arrange, SINGLETON_SLUG } from './store.js';

/** Who is calling: the token's name, its scopes, and the singletons and collections it may touch. */
export type Agent = { name: string; scopes: ReadonlySet<AgentScope>; keys: readonly string[] };

export type ToolResult = { ok: boolean; [key: string]: unknown };

export type Tool = {
  name: string;
  description: string;
  scope: AgentScope;
  input: z.ZodObject;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run(args: Record<string, unknown>, call: { agent: Agent; origin: string }): Promise<ToolResult>;
};

type Def = Singleton | Collection;
type Stored = { slug: string; data: unknown; status: string; createdAt: Date; updatedAt: Date };

const enumOf = (values: readonly string[]) => z.enum(values as [string, ...string[]]);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Every string in an entry (rich text included), for search. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'type' && k !== 'kind') strings(x, out);
  return out;
}

/** Every tool, over the content this agent's token may touch. The caller checks scopes. */
export function mcpTools(ctx: Context, content: ContentService, agent: Agent): Tool[] {
  const { store, storage, config } = ctx;
  const keys = agent.keys;
  const collections = keys.filter((k) => config[k].kind === 'collection');
  const defOf = (key: string): Def => config[key];

  // Every key arg is checked against the agent's keys by the enum, so a token limited to `posts` can't name another.
  const anyKey = keys.length ? enumOf(keys).describe('A singleton or collection key from get_schema.') : null;
  const collectionKey = collections.length ? enumOf(collections).describe('A collection key from get_schema.') : null;
  const slugArg = z.string().optional().describe('The entry slug. Leave out for a singleton.');

  const slugFor = (key: string, slug: unknown) => (defOf(key).kind === 'singleton' ? SINGLETON_SLUG : typeof slug === 'string' ? slug : '');

  async function row(key: string, slug: string): Promise<Stored | undefined> {
    return (await storage.readRows(key)).find((r) => r.slug === slug);
  }

  /** The entry's latest version: its pending changes, else its stored row. */
  async function latest(key: string, slug: string) {
    const r = await row(key, slug);
    const pending = await store.getPending(key, slug);
    return { row: r, pending, data: pending ?? r?.data };
  }

  /** What an agent's (partial) data turns into: the base filled in, the given fields on top. Null plus errors for unknown fields. */
  function merge(def: Def, base: unknown, patch: unknown): { data: unknown } | { errors: Record<string, string> } {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { errors: { $data: 'Expected an object of fields.' } };
    const unknown = unknownFields(def.fields, patch);
    if (unknown.length) return { errors: Object.fromEntries(unknown.map((p) => [p, 'Not a field. See get_schema.'])) };
    return { data: withDefaults(def.fields, { ...(withDefaults(def.fields, base) as object), ...patch }) };
  }

  /** Records a delete or discard for an editor to approve, and says where. */
  async function request(key: string, slug: string | undefined, action: 'delete' | 'discard', by: string, origin: string): Promise<ToolResult> {
    const r = await content.requestApproval(key, slug, action, by);
    if (!r.ok) return r;
    const page = defOf(key).kind === 'collection' ? `${ctx.adminPath}/${key}/${slug}` : `${ctx.adminPath}/${key}`;
    return { ok: true, status: 'awaiting_approval', message: r.message, approveUrl: `${origin}${page}` };
  }

  const invalid = (errors: Record<string, string>): ToolResult => ({ ok: false, message: 'Fix the listed fields.', errors });

  const tools: (Tool | null)[] = [
    {
      name: 'get_schema',
      description:
        'The content model: every singleton and collection this token can use, with each field as JSON Schema (types, required fields, select options, limits). Call it first.',
      scope: 'read',
      input: z.object({}),
      annotations: { readOnlyHint: true },
      run: async () => ({
        ok: true,
        content: keys.map((k) => describeContent(k, defOf(k))),
        notes: [
          'Writes are drafts: they never change the live site. publish makes them live (needs the publish scope).',
          'Editing a published entry keeps the live version until publish. diff_entry shows the difference.',
          'Fields you leave out keep their value (update) or start empty (create).',
          'delete_entry and discard_draft only ask: an editor approves or rejects them in the admin.',
        ],
      }),
    },

    collectionKey && {
      name: 'list_entries',
      description: 'Entries of a collection with their status, timestamps and live data. hasDraftChanges means unpublished edits exist (get_entry shows them).',
      scope: 'read',
      input: z.object({
        collection: collectionKey,
        status: z.enum(['all', 'published', 'draft']).default('all'),
        orderBy: z.string().optional().describe("A field, or 'slug' | 'createdAt' | 'updatedAt'. Default 'slug'."),
        order: z.enum(['asc', 'desc']).default('asc'),
        fields: z.array(z.string()).optional().describe('Only return these fields of each entry. Default: all.'),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: { readOnlyHint: true },
      async run(a) {
        const key = a.collection as string;
        const def = defOf(key);
        const pending = await store.listPending(key);
        const items = (await storage.readRows(key))
          .filter((r) => a.status === 'all' || r.status === a.status)
          .map((r) => ({
            slug: r.slug,
            status: r.status as 'draft' | 'published',
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            entry: withDefaults(def.fields, r.data),
          }));
        const page = arrange(items, { orderBy: a.orderBy as never, order: a.order as 'asc' | 'desc', limit: a.limit as number, offset: a.offset as number });
        const pick = a.fields as string[] | undefined;
        return {
          ok: true,
          total: items.length,
          entries: page.map((i) => ({
            slug: i.slug,
            status: i.status,
            hasDraftChanges: pending.has(i.slug),
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
            entry: pick ? Object.fromEntries(Object.entries(i.entry).filter(([k]) => pick.includes(k))) : i.entry,
          })),
        };
      },
    },

    anyKey && {
      name: 'get_entry',
      description: 'One entry at its latest version (unpublished edits included), with status and timestamps.',
      scope: 'read',
      input: z.object({ collection: anyKey, slug: slugArg }),
      annotations: { readOnlyHint: true },
      async run(a) {
        const key = a.collection as string;
        const slug = slugFor(key, a.slug);
        const { row: r, pending, data } = await latest(key, slug);
        if (!r && pending === undefined) {
          if (defOf(key).kind === 'collection') return { ok: false, message: `No entry "${slug}" in ${key}.` };
          return { ok: true, exists: false, entry: withDefaults(defOf(key).fields, {}) };
        }
        return {
          ok: true,
          slug: defOf(key).kind === 'collection' ? slug : undefined,
          status: r?.status ?? 'draft',
          hasDraftChanges: pending !== undefined,
          awaitingApproval: (await store.getRequest(key, slug)) ?? null,
          createdAt: r?.createdAt,
          updatedAt: r?.updatedAt,
          entry: withDefaults(defOf(key).fields, data),
        };
      },
    },

    anyKey && {
      name: 'search',
      description: 'Finds entries whose text (rich text included) contains the query, case-insensitive. Searches latest versions.',
      scope: 'read',
      input: z.object({
        query: z.string().min(1),
        collections: z.array(anyKey).optional().describe('Default: everything this token can read.'),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true },
      async run(a) {
        const q = (a.query as string).toLowerCase();
        const hits: { collection: string; slug?: string; status: string; title?: string; snippet: string }[] = [];
        for (const key of (a.collections as string[] | undefined) ?? keys) {
          const def = defOf(key);
          const pending = await store.listPending(key);
          for (const r of await storage.readRows(key)) {
            const data = pending.has(r.slug) ? await store.getPending(key, r.slug) : r.data;
            const found = strings(data).find((s) => s.toLowerCase().includes(q));
            if (!found) continue;
            const at = found.toLowerCase().indexOf(q);
            hits.push({
              collection: key,
              ...(def.kind === 'collection' && { slug: r.slug, title: text((data as Record<string, unknown>)?.[def.titleField]) }),
              status: r.status,
              snippet: found.slice(Math.max(0, at - 60), at + q.length + 60),
            });
          }
        }
        return { ok: true, total: hits.length, results: hits.slice(0, a.limit as number) };
      },
    },

    collectionKey && {
      name: 'create_entry',
      description:
        'Creates a collection entry as a draft (not on the site). The slug comes from the title field unless given. Fields left out start empty or at their default. Returns per-field errors if invalid.',
      scope: 'draft',
      input: z.object({
        collection: collectionKey,
        data: z.record(z.string(), z.unknown()).describe('Field values, shaped as in get_schema.'),
        slug: z.string().optional(),
      }),
      async run(a, { agent }) {
        const key = a.collection as string;
        const def = defOf(key) as Collection;
        const m = merge(def, initialValues(def.fields), a.data);
        if ('errors' in m) return invalid(m.errors);
        const slug = (a.slug as string | undefined) ?? slugify(text((m.data as Record<string, unknown>)[def.titleField]));
        const r = await content.save({ key, slug, mode: 'create', action: 'draft', data: m.data }, agent.name);
        return r.ok ? { ok: true, slug, status: 'draft', message: r.message } : r;
      },
    },

    anyKey && {
      name: 'update_entry',
      description:
        'Changes some fields of an entry; fields left out keep their value. Saved as a draft: a published entry stays live unchanged until publish. A singleton without drafts goes live at once, so it needs the publish scope.',
      scope: 'draft',
      input: z.object({
        collection: anyKey,
        slug: slugArg,
        data: z.record(z.string(), z.unknown()).describe('The fields to change, shaped as in get_schema. Each replaces the whole field value.'),
      }),
      async run(a, { agent }) {
        const key = a.collection as string;
        const def = defOf(key);
        const slug = slugFor(key, a.slug);
        const { row: r, data } = await latest(key, slug);
        if (def.kind === 'collection' && !r) return { ok: false, message: `No entry "${slug}" in ${key}. Use create_entry.` };
        const m = merge(def, data, a.data);
        if ('errors' in m) return invalid(m.errors);
        if (def.kind === 'singleton' && !def.drafts) {
          if (!agent.scopes.has('publish')) return { ok: false, message: `"${key}" has no drafts, so saving it publishes it. That needs the publish scope.` };
          return content.save({ key, slug, mode: 'update', action: 'publish', data: m.data }, agent.name);
        }
        return content.saveDraft({ key, slug, data: m.data });
      },
    },

    anyKey && {
      name: 'validate_entry',
      description:
        'Checks data without saving it: the same merge and checks as create_entry (new slug) or update_entry (existing entry). Returns per-field errors.',
      scope: 'read',
      input: z.object({ collection: anyKey, slug: slugArg, data: z.record(z.string(), z.unknown()) }),
      annotations: { readOnlyHint: true },
      async run(a) {
        const key = a.collection as string;
        const def = defOf(key);
        const slug = slugFor(key, a.slug);
        const existing = slug ? (await latest(key, slug)).data : undefined;
        const m = merge(def, existing ?? initialValues(def.fields), a.data);
        if ('errors' in m) return invalid(m.errors);
        const at = def.kind === 'collection' && !slug ? slugify(text((m.data as Record<string, unknown>)[def.titleField])) : slug;
        const v = content.validate({ key, slug: at, data: m.data });
        return v.ok ? { ok: true, message: 'Valid.' } : v;
      },
    },

    anyKey && {
      name: 'diff_entry',
      description: 'The fields whose unpublished version differs from the live one: [{ field, live, draft }].',
      scope: 'read',
      input: z.object({ collection: anyKey, slug: slugArg }),
      annotations: { readOnlyHint: true },
      async run(a) {
        const key = a.collection as string;
        const def = defOf(key);
        const slug = slugFor(key, a.slug);
        const { row: r, pending } = await latest(key, slug);
        if (!r && pending === undefined) return { ok: false, message: 'This entry does not exist.' };
        const live = r?.status === 'published' ? withDefaults(def.fields, r.data) : null;
        const draft = pending !== undefined ? withDefaults(def.fields, pending) : r?.status === 'draft' ? withDefaults(def.fields, r.data) : null;
        if (!draft) return { ok: true, published: true, changes: [], message: 'No unpublished changes.' };
        const changes = Object.keys(def.fields).flatMap((field) => {
          const x = (live as Record<string, unknown> | null)?.[field];
          const y = (draft as Record<string, unknown>)[field];
          return JSON.stringify(canonical(x)) === JSON.stringify(canonical(y)) ? [] : [{ field, live: x ?? null, draft: y }];
        });
        return { ok: true, published: !!live, changes };
      },
    },

    anyKey && {
      name: 'publish',
      description: "Makes an entry's latest version live on the site.",
      scope: 'publish',
      input: z.object({ collection: anyKey, slug: slugArg }),
      annotations: { idempotentHint: true },
      run: (a, { agent }) => content.publish(a.collection as string, a.slug as string | undefined, agent.name),
    },

    collectionKey && {
      name: 'unpublish',
      description: 'Takes a collection entry off the site. Its latest version is kept as a draft.',
      scope: 'publish',
      input: z.object({ collection: collectionKey, slug: z.string() }),
      annotations: { idempotentHint: true },
      run: (a, { agent }) => content.unpublish(a.collection as string, a.slug as string, agent.name),
    },

    anyKey && {
      name: 'discard_draft',
      description:
        "Asks to throw away an entry's unpublished changes. An editor must approve it in the admin, so nothing changes yet. Tell the user and give them approveUrl.",
      scope: 'publish',
      input: z.object({ collection: anyKey, slug: slugArg }),
      annotations: { idempotentHint: true },
      run: (a, { agent, origin }) => request(a.collection as string, a.slug as string | undefined, 'discard', agent.name, origin),
    },

    collectionKey && {
      name: 'delete_entry',
      description:
        'Asks to delete a collection entry for good. An editor must approve it in the admin, so nothing changes yet. Tell the user and give them approveUrl.',
      scope: 'delete',
      input: z.object({ collection: collectionKey, slug: z.string() }),
      annotations: { idempotentHint: true },
      run: (a, { agent, origin }) => request(a.collection as string, a.slug as string, 'delete', agent.name, origin),
    },

    ctx.options.media
      ? {
          name: 'upload_media_from_url',
          description:
            'Copies an https:// image (JPEG, PNG, WebP, GIF, AVIF, up to 4 MB) into the site storage. Returns an image value for an image field. The same URL is stored once.',
          scope: 'draft',
          input: z.object({ url: z.string(), alt: z.string().max(300).default('').describe('Describes the image.') }),
          annotations: { idempotentHint: true },
          async run(a) {
            const r = await mediaImporter(ctx.options.media!, { apiPath: ctx.apiPath })(a.url as string);
            return { ok: true, image: { url: r.url, alt: a.alt }, reused: r.reused };
          },
        }
      : null,

    anyKey && {
      name: 'get_preview_url',
      description: "A link that opens the entry's latest version (drafts included) on the site. A person signed in to the admin opens it.",
      scope: 'read',
      input: z.object({ collection: anyKey, slug: slugArg }),
      annotations: { readOnlyHint: true },
      async run(a, { origin }) {
        const key = a.collection as string;
        const target = previewTarget(ctx, key, a.slug as string | undefined);
        if (!target) return { ok: false, message: 'This content has no page on the site.' };
        const q = new URLSearchParams({ key, ...(defOf(key).kind === 'collection' && { slug: target.slug }) });
        return { ok: true, url: `${origin}${ctx.apiPath}/preview/open?${q}`, path: target.path };
      },
    },
  ];

  return tools.filter((t): t is Tool => !!t);
}
