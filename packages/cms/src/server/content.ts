import 'server-only';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AutosaveInput, AutosaveResult, EntryInput, Invalid, SaveResult } from '../api.js';
import { objectSchema, slugSchema } from '../define.js';
import type { Change, Context } from './context.js';
import { revOf } from './rev.js';
import { SINGLETON_SLUG } from './store.js';

// The one write path. The admin route handlers and the MCP tools both call these, after their own auth,
// so every write is validated the same way and the site is revalidated the same way.

export type Valid = { ok: true; key: string; slug: string; data: unknown };
type Done = { ok: true; message: string } | Invalid;

/** Checks the key, the fields and the slug. */
export function validate(ctx: Context, input: Pick<EntryInput, 'key' | 'slug' | 'data'>): Invalid | Valid {
  const def = Object.hasOwn(ctx.config, input.key) ? ctx.config[input.key] : undefined;
  if (!def) return { ok: false, message: 'Unknown collection.', errors: {} };

  const errors: Record<string, string> = {};
  const parsed = objectSchema(def.fields).safeParse(input.data);
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path.join('.')] ??= i.message;

  let slug = SINGLETON_SLUG;
  if (def.kind === 'collection') {
    const s = slugSchema.safeParse(input.slug);
    if (s.success) slug = s.data;
    else errors.$slug = s.error.issues[0].message;
  }
  if (!parsed.success || errors.$slug) return { ok: false, message: 'Fix the highlighted fields.', errors };
  return { ok: true, key: input.key, slug, data: parsed.data };
}

/** Revalidates the site, then runs `onChange` after the response is sent. */
function changed(ctx: Context, change: Change) {
  (ctx.options.revalidate ?? (() => revalidatePath('/', 'layout')))(change);
  const onChange = ctx.options.onChange;
  if (onChange)
    after(async () => {
      try {
        await onChange(change);
      } catch (e) {
        console.error('cms onChange failed:', e);
      }
    });
}

/**
 * Where an entry shows on the site, for opening its latest version in Draft Mode: a collection entry's
 * `basePath/<slug>` (even with `preview` off), a singleton's `preview` path. Null when there is none.
 */
export function previewTarget(ctx: Context, key: string, slug?: string): { slug: string; path: string } | null {
  const def = Object.hasOwn(ctx.config, key) ? ctx.config[key] : undefined;
  if (!def) return null;
  if (def.kind === 'singleton') return def.preview ? { slug: SINGLETON_SLUG, path: def.preview } : null;
  const s = slugSchema.safeParse(slug);
  return s.success ? { slug: s.data, path: `${def.basePath}/${s.data}` } : null;
}

const unknownEntry: Invalid = { ok: false, message: 'Unknown entry.', errors: {} };

export function createContentService(ctx: Context) {
  const { store } = ctx;
  const defOf = (key: unknown) => (typeof key === 'string' && Object.hasOwn(ctx.config, key) ? ctx.config[key] : undefined);

  /**
   * Stores already validated data as the entry's draft. A published entry (or a singleton) keeps its live version and
   * gets the data as pending changes; an entry that was never published is updated in place. The site is unchanged.
   * Returns whether the draft now differs from the live version.
   */
  async function writeDraft(v: Valid) {
    const def = ctx.config[v.key];
    const live = await store.getRow(v.key, v.slug);
    let changes = false;
    if (live?.status === 'draft') {
      await store.upsert(v.key, v.slug, v.data, 'draft');
      changes = true;
    } else if (live && revOf(def, live.data) === revOf(def, v.data)) {
      // Edited back to the live version: nothing left to publish.
      await store.removePending(v.key, v.slug);
    } else {
      await store.savePending(v.key, v.slug, v.data);
      changes = true;
    }
    // A preview copy of an unsaved form would shadow the draft.
    await store.removeDraft(v.key, v.slug);
    return changes;
  }

  const service = {
    validate: (input: Pick<EntryInput, 'key' | 'slug' | 'data'>) => validate(ctx, input),

    /**
     * The admin's Save: creates or updates an entry and publishes it, keeps it as a draft, or unpublishes it
     * (singletons always publish). `created` is true when a new collection entry was inserted.
     */
    async save(input: EntryInput, by?: string): Promise<SaveResult & { created?: boolean }> {
      const v = validate(ctx, input);
      if (!v.ok) return v;
      const isCollection = ctx.config[v.key].kind === 'collection';
      const action = input.action ?? 'publish';
      if (action !== 'publish' && action !== 'draft' && action !== 'unpublish') return { ok: false, message: 'Unknown action.', errors: {} };
      const isNew = isCollection && input.mode === 'create';
      // Singletons are always live. A draft of an already published entry is kept beside it as pending changes.
      const live = !isCollection || action === 'publish';
      const pendingOnly = isCollection && action === 'draft' && !isNew && (await store.getStatus(v.key, v.slug)) === 'published';
      const status = live ? 'published' : 'draft';

      if (isNew) {
        if (!(await store.insert(v.key, v.slug, v.data, status))) {
          return { ok: false, message: 'That slug is already in use.', errors: { $slug: 'Already in use' } };
        }
      } else if (pendingOnly) {
        await store.savePending(v.key, v.slug, v.data);
      } else {
        await store.upsert(v.key, v.slug, v.data, status);
      }
      if (!pendingOnly) await store.removePending(v.key, v.slug);
      await store.removeDraft(v.key, v.slug);
      // Pending changes aren't on the site, so there is nothing to revalidate.
      if (!pendingOnly) changed(ctx, { type: 'save', key: v.key, slug: v.slug, ...(by && { by }) });
      return {
        ok: true,
        created: isNew,
        message: pendingOnly
          ? 'Draft saved. The live site is unchanged.'
          : action === 'unpublish'
            ? 'Unpublished. It is no longer on the site.'
            : action === 'draft'
              ? 'Saved as a draft. It is not on the site.'
              : isCollection
                ? 'Published. The site is updated.'
                : 'Saved. The site is updated.',
        rev: revOf(ctx.config[v.key], v.data),
      };
    },

    /**
     * The admin's autosave: keeps the form's data as the entry's draft, so the live version only changes on Publish.
     * Refuses when the stored entry has changed since the form loaded it (`rev`).
     */
    async autosave(input: AutosaveInput): Promise<AutosaveResult> {
      const v = validate(ctx, input);
      if (!v.ok) return v;
      const def = ctx.config[v.key];
      if (def.kind === 'collection' ? input.mode !== 'update' : !def.drafts) {
        return { ok: false, message: 'Autosave is not available for this content.', errors: {} };
      }
      const live = await store.getRow(v.key, v.slug);
      if (def.kind === 'collection' && !live) return { ok: false, message: 'This entry no longer exists.', errors: {} };
      const current = (await store.getPending(v.key, v.slug)) ?? live?.data;
      if (input.rev !== revOf(def, current)) {
        return { ok: false, conflict: true, message: 'Changed somewhere else. Reload to see the latest version.', errors: {} };
      }
      const changes = await writeDraft(v);
      return { ok: true, rev: revOf(def, v.data), changes: live?.status === 'draft' ? false : changes };
    },

    /**
     * Saves data as a draft of an existing entry (or a singleton with `drafts: true`) without touching the live
     * version. Fails for a collection entry that doesn't exist and for a singleton without drafts.
     */
    async saveDraft(input: Pick<EntryInput, 'key' | 'slug' | 'data'>): Promise<Invalid | { ok: true; message: string; changes: boolean; rev: string }> {
      const v = validate(ctx, input);
      if (!v.ok) return v;
      const def = ctx.config[v.key];
      if (def.kind === 'singleton' && !def.drafts) return { ok: false, message: 'This singleton has no drafts: saving it publishes it.', errors: {} };
      if (def.kind === 'collection' && !(await store.getRow(v.key, v.slug))) return { ok: false, message: 'This entry does not exist.', errors: {} };
      const changes = await writeDraft(v);
      return {
        ok: true,
        changes,
        rev: revOf(def, v.data),
        message: changes ? 'Draft saved. The live site is unchanged.' : 'No changes from the live version.',
      };
    },

    /** Makes the entry's latest version (its pending changes, or its draft) the live one. */
    async publish(key: string, slug: string | undefined, by?: string): Promise<SaveResult> {
      const def = defOf(key);
      const at = def?.kind === 'singleton' ? SINGLETON_SLUG : slug;
      if (!def || typeof at !== 'string') return unknownEntry;
      const row = await store.getRow(key, at);
      const pending = await store.getPending(key, at);
      if (pending === undefined && !row) return { ok: false, message: 'This entry does not exist.', errors: {} };
      if (pending === undefined && row?.status === 'published') return { ok: true, message: 'Already published. There were no changes to publish.' };
      return service.save({ key, slug: at, mode: 'update', action: 'publish', data: pending ?? row?.data }, by);
    },

    /** Takes a published collection entry off the site. Its latest version (with any pending changes) becomes its draft. */
    async unpublish(key: string, slug: string, by?: string): Promise<SaveResult> {
      const def = defOf(key);
      if (def?.kind !== 'collection' || typeof slug !== 'string') return unknownEntry;
      const row = await store.getRow(key, slug);
      if (!row) return { ok: false, message: 'This entry does not exist.', errors: {} };
      if (row.status === 'draft') return { ok: true, message: 'Already unpublished.' };
      const data = (await store.getPending(key, slug)) ?? row.data;
      return service.save({ key, slug, mode: 'update', action: 'unpublish', data }, by);
    },

    /** Throws away an entry's unpublished changes, going back to the live version. */
    async discard(key: unknown, slug: unknown): Promise<Done> {
      const def = defOf(key);
      const at = def?.kind === 'singleton' ? SINGLETON_SLUG : slug;
      if (!def || typeof at !== 'string') return unknownEntry;
      await store.removePending(key as string, at);
      await store.removeDraft(key as string, at);
      if ((await store.getRequest(key as string, at))?.action === 'discard') await store.removeRequest(key as string, at);
      return { ok: true, message: 'Draft discarded. The live version is unchanged.' };
    },

    /**
     * Records an agent's request to delete an entry or discard its draft. Nothing changes until an editor approves it
     * in the admin. One request per entry: a new one replaces the last.
     */
    async requestApproval(key: string, slug: string | undefined, action: 'delete' | 'discard', by: string): Promise<Done> {
      const def = defOf(key);
      const at = def?.kind === 'singleton' ? SINGLETON_SLUG : slug;
      if (!def || typeof at !== 'string' || (action === 'delete' && def.kind !== 'collection')) return unknownEntry;
      const row = await store.getRow(key, at);
      const pending = await store.getPending(key, at);
      if (action === 'delete' && !row) return { ok: false, message: 'This entry does not exist.', errors: {} };
      if (action === 'discard' && pending === undefined) return { ok: false, message: 'There are no unpublished changes to discard.', errors: {} };
      await store.saveRequest(key, at, {
        action,
        by,
        at: new Date().toISOString(),
        ...(action === 'discard' && { rev: revOf(def, pending) }),
      });
      return {
        ok: true,
        message: `Requested. An editor must approve the ${action === 'delete' ? 'delete' : 'discard'} in the admin. Nothing has changed yet.`,
      };
    },

    /** An editor's answer to an agent's request: carries it out, or drops it. */
    async resolveRequest(key: unknown, slug: unknown, approve: boolean): Promise<Done & { deleted?: boolean }> {
      const def = defOf(key);
      const at = def?.kind === 'singleton' ? SINGLETON_SLUG : slug;
      if (!def || typeof at !== 'string') return unknownEntry;
      const k = key as string;
      const request = await store.getRequest(k, at);
      if (!request) return { ok: false, message: 'There is no request for this entry.', errors: {} };
      await store.removeRequest(k, at);
      if (!approve) return { ok: true, message: 'Request rejected. Nothing was changed.' };
      if (request.action === 'delete') return { ...(await service.remove(k, at, request.by)), deleted: true };
      const pending = await store.getPending(k, at);
      if (pending === undefined) return { ok: true, message: 'There were no unpublished changes left to discard.' };
      if (revOf(def, pending) !== request.rev) return { ok: false, message: 'The draft changed after the request, so it was not discarded.', errors: {} };
      return service.discard(k, at);
    },

    /** Deletes a collection entry with its draft and pending changes. */
    async remove(key: unknown, slug: unknown, by?: string): Promise<Done> {
      const def = defOf(key);
      if (def?.kind !== 'collection' || typeof slug !== 'string') return unknownEntry;
      await store.remove(key as string, slug);
      await store.removeDraft(key as string, slug);
      await store.removePending(key as string, slug);
      await store.removeRequest(key as string, slug);
      changed(ctx, { type: 'delete', key: key as string, slug, ...(by && { by }) });
      return { ok: true, message: 'Deleted.' };
    },
  };
  return service;
}

export type ContentService = ReturnType<typeof createContentService>;
