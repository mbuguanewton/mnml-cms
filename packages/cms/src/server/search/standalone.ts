import type { CmsConfig } from '../../schema/define.js';
import type { Database } from '../content/db.js';
import { drizzleStorage, type EntryStorage } from '../content/storage.js';
import { postgresSearch } from './postgres.js';
import { buildSearch } from './search.js';
import type { SearchOptions } from './types.js';

export type CreateSearchOptions = {
  /** Where the entries are: the same `database` or `storage` you gave `createCms`. */
  database?: Database | (() => Database);
  storage?: EntryStorage;
  /** The entries table, if you renamed it with `createCms`'s `table`. Default 'entries'. */
  entriesTable?: string;
  /** The same `search` options as `createCms` (`index`, `table`, `language`). */
  search?: Omit<SearchOptions, 'route'>;
};

/**
 * Search without Next.js, for scripts and cron jobs: `await createSearch(config, { database }).reindex()` after an
 * import or a sync. Same options as `createCms`.
 */
export function createSearch(config: CmsConfig, { database, storage, entriesTable, search = {} }: CreateSearchOptions) {
  const getDb = typeof database === 'function' ? database : database ? () => database : undefined;
  const entries = storage ?? (getDb ? drizzleStorage(getDb, entriesTable) : undefined);
  if (!entries) throw new Error('createSearch needs `database` or `storage`.');
  const index = search.index ?? (getDb ? postgresSearch({ database: getDb, ...search }) : undefined);
  if (!index) throw new Error('With a custom `storage`, pass `search: { index }`.');
  return buildSearch({ config, storage: entries, index });
}
