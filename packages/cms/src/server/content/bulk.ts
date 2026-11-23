import type { BulkResult } from '../../api.js';
import { slugSchema } from '../../schema/define.js';
import type { Context, ListAction } from '../context.js';
import type { ContentService } from './content.js';

/** The most entries one bulk request takes. */
export const MAX_BULK = 100;

/** The actions every collection list has. A site's `listActions` are added after these. */
export const BUILT_IN_ACTIONS = ['publish', 'unpublish', 'delete'] as const;

type Results = Extract<BulkResult, { ok: true }>['results'];

/** The first problem of an invalid save, e.g. "title: Required", or its message. */
const why = (r: { message: string; errors?: Record<string, string> }) => {
  const first = Object.entries(r.errors ?? {})[0];
  return first ? `${first[0]}: ${first[1]}` : r.message;
};

/**
 * Runs one action on the selected entries of a collection, one at a time through the content service, so each is
 * validated, revalidated and reported like a single save. A problem with one entry never stops the others.
 */
export async function runBulk(
  ctx: Context,
  content: ContentService,
  input: { key: unknown; slugs: unknown; action: unknown },
): Promise<BulkResult & { status: number }> {
  const { key, slugs, action } = input;
  const def = typeof key === 'string' && Object.hasOwn(ctx.config, key) ? ctx.config[key] : undefined;
  if (def?.kind !== 'collection' || typeof key !== 'string') return { ok: false, message: 'Unknown collection.', status: 400 };
  const custom: ListAction | undefined = (ctx.options.listActions as Record<string, ListAction[] | undefined> | undefined)?.[key]?.find(
    (a) => a.name === action,
  );
  if (!(BUILT_IN_ACTIONS as readonly unknown[]).includes(action) && !custom) return { ok: false, message: 'Unknown action.', status: 400 };
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_BULK || !slugs.every((s) => slugSchema.safeParse(s).success)) {
    return { ok: false, message: `Pick between 1 and ${MAX_BULK} entries.`, status: 400 };
  }

  const results: Results = { done: [], skipped: [], failed: [] };
  for (const slug of new Set(slugs as string[])) {
    const row = await ctx.store.getRow(key, slug);
    if (!row) {
      results.skipped.push({ slug, message: 'This entry does not exist.' });
      continue;
    }
    const pending = await ctx.store.getPending(key, slug);
    try {
      if (action === 'publish' && pending === undefined && row.status === 'published') {
        results.skipped.push({ slug, message: 'Already published.' });
      } else if (action === 'unpublish' && row.status === 'draft') {
        results.skipped.push({ slug, message: 'Already a draft.' });
      } else if (custom) {
        await custom.run({ key, slug, entry: (pending ?? row.data) as Record<string, unknown> });
        results.done.push(slug);
      } else {
        const r =
          action === 'publish'
            ? await content.publish(key, slug)
            : action === 'unpublish'
              ? await content.unpublish(key, slug)
              : await content.remove(key, slug);
        if (r.ok) results.done.push(slug);
        else results.failed.push({ slug, message: why(r) });
      }
    } catch (e) {
      results.failed.push({ slug, message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }
  return { ok: true, results, status: 200 };
}
