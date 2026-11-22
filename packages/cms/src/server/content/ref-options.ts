import 'server-only';
import type { RefOptions } from '../../admin/entry/fields.js';
import { displayText } from '../../schema/text.js';
import type { CmsConfig } from '../../schema/define.js';
import type { Context } from '../context.js';

/** Published entries of these collections, as `{ slug, label }` sorted by title: what reference pickers offer. */
export async function loadRefOptions<C extends CmsConfig>(ctx: Context<C>, collections: Iterable<string>): Promise<RefOptions> {
  const out: RefOptions = {};
  for (const target of new Set(collections)) {
    const t = Object.hasOwn(ctx.config, target) ? ctx.config[target] : undefined;
    if (t?.kind !== 'collection') continue;
    const items = (await ctx.store.listEntries(target as never, { drafts: false, orderBy: t.titleField } as never)) as {
      slug: string;
      entry: Record<string, unknown>;
    }[];
    out[target] = items.map(({ slug, entry }) => ({ slug, label: displayText(entry[t.titleField]) || slug }));
  }
  return out;
}
