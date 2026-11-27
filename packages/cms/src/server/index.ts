import 'server-only';
import type { CmsConfig } from '../schema/define.js';
import { createAdminPage } from './admin/admin-page.js';
import { isAdmin } from './auth/auth.js';
import { createContext, type CmsOptions } from './context.js';
import { cachedReaders } from './content/cached-store.js';
import { createHandlers } from './admin/handlers.js';
import type { SearchHit, SearchQuery } from './search/types.js';
import { createPreviewBanner } from './admin/preview-banner.js';

export type { BrandLogo, BrandOption } from './admin/brand.js';
export type { AdminPageDef, AgentScope, AgentToken, Change, CmsOptions, ListAction, McpOptions } from './context.js';
export type { AiEvent, AiMessage, AiModel, AiOptions, AiRequest, AiTool, AiToolCall } from './ai/types.js';
export type { AuthAdapter, PasswordAuth } from './auth/auth.js';
export type { CacheOption } from './content/cached-store.js';
export type { ListOptions, ReadOptions } from './content/store.js';
export { neonDatabase, type Database } from './content/db.js';
export type { EntryStorage, StoredRow } from './content/storage.js';
export { drizzleStorage } from './content/storage.js';
export { entryId, searchEntry } from './search/entry.js';
export { fuseMatches } from './search/rank.js';
export type { SearchChunk, SearchEntry, SearchHit, SearchIndex, SearchMatch, SearchOptions, SearchQuery } from './search/types.js';
export { localMedia, vercelBlobMedia, type MediaFile, type MediaStorage } from './media/media.js';

/**
 * Set up the CMS for a Next.js app.
 *
 *   export const cms = createCms(config, { database, auth, media });
 *
 *   app/admin/[[...path]]/page.tsx   export default cms.AdminPage;
 *   app/api/mnml/[...route]/route.ts  export const { GET, POST } = cms.handlers;
 *   app/(site)/layout.tsx            <cms.PreviewBanner />
 *   pages                            await cms.getEntry('posts', slug)
 */
export function createCms<C extends CmsConfig>(config: C, options: CmsOptions<C>) {
  const ctx = createContext(config, options);
  const { getSingleton, listEntries, getEntry, getEntries, listSlugs } = cachedReaders(ctx.readers, options.cache);
  const off = () => {
    throw new Error('Search is off. Turn it on with `search: { index }` in createCms().');
  };
  const search = Object.assign((query: string, o?: SearchQuery): Promise<SearchHit[]> => (ctx.search ? ctx.search.query(query, o) : off()), {
    reindex: (): Promise<{ entries: number; chunks: number; failed: { key: string; slug: string | null; message: string }[] }> =>
      ctx.search ? ctx.search.reindex() : off(),
  });
  return {
    config,
    getSingleton,
    listEntries,
    getEntry,
    getEntries,
    listSlugs,
    /**
     * Search published content: `await cms.search('refund policy', { collections: ['posts'], limit: 5 })`. The best
     * passage of each entry, best first. `cms.search.reindex()` rebuilds the index. Needs the `search` option.
     */
    search,
    /** Whether the current request has a valid admin session (for your own routes). */
    isAdmin: () => isAdmin(ctx),
    handlers: createHandlers(ctx),
    AdminPage: createAdminPage(ctx),
    PreviewBanner: createPreviewBanner(ctx.apiPath),
  };
}
