import type { CmsConfig } from '../../schema/define.js';
import type { EntryStorage } from '../content/storage.js';
import { buildSearch } from './search.js';
import type { SearchIndex } from './types.js';

/**
 * Search without Next.js, for scripts and cron jobs: `await createSearch(config, { storage, index }).reindex()` after
 * an import or a sync. Use the same storage and index as `createCms`.
 */
export function createSearch(config: CmsConfig, { storage, index }: { storage: EntryStorage; index: SearchIndex }) {
  return buildSearch({ config, storage, index });
}
