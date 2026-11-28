import { createHash } from 'node:crypto';
import type { CmsConfig } from '../../schema/define.js';
import { fitDefaults } from '../../schema/fit.js';
import { chunkEntry } from './chunk.js';
import type { SearchEntry } from './types.js';

/** The id of an entry in the index: `posts/hello`, or `settings/` for a singleton (null slug). */
export const entryId = (key: string, slug: string | null) => `${key}/${slug ?? ''}`;

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * The searchable form of one entry: its title, link and passages. Pass the entry's stored data (published, never a
 * draft). Null for a key that is not in the config. Use it to feed your own index from `onChange` when you don't
 * want a `SearchIndex` adapter.
 */
export function searchEntry(config: CmsConfig, key: string, slug: string, data: unknown): SearchEntry | null {
  if (!Object.hasOwn(config, key)) return null;
  const def = config[key];
  const fitted = fitDefaults(def.fields, data);
  const title = def.kind === 'collection' ? text(fitted[def.titleField]) || slug : def.label;
  const url = def.kind === 'collection' ? `${def.basePath}/${slug}` : (def.preview ?? null);
  const entrySlug = def.kind === 'singleton' ? null : slug;
  return {
    id: entryId(key, entrySlug),
    key,
    slug: entrySlug,
    title,
    url,
    chunks: chunkEntry(def, fitted).map((c) => ({ ...c, hash: sha([title, url ?? '', c.field, c.text].join('\u0000')) })),
  };
}
