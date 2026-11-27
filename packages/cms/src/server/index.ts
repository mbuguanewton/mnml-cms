import 'server-only';
import type { CmsConfig } from '../schema/define.js';
import { createAdminPage } from './admin/admin-page.js';
import { isAdmin } from './auth/auth.js';
import { createContext, type CmsOptions } from './context.js';
import { cachedReaders } from './content/cached-store.js';
import { createHandlers } from './admin/handlers.js';
import type { SearchHit, SearchQuery } from './search/types.js';
import { createPreviewBanner } from './admin/preview-banner.js';
import { createContentService } from './content/content.js';
import { readTools } from './ai/tools.js';

export type { BrandLogo, BrandOption } from './admin/brand.js';
export type { AdminPageDef, AgentScope, AgentToken, Change, CmsOptions, ListAction, McpOptions } from './context.js';
export type { AssistantEngine } from './ai/types.js';
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
    /**
     * The CMS's read tools as AI SDK tools, for your own agent or RAG code: `streamText({ model, tools: cms.tools() })`.
     * Search (when `search` is on), list entries, get an entry and get the schema; they read published content and
     * drafts, and cannot write. `collections` limits what they can see. Needs the `ai` package, which you import
     * yourself; this package does not load it here.
     */
    tools: (o: { collections?: string[] } = {}) => {
      const unknown = (o.collections ?? []).filter((k) => !Object.hasOwn(config, k));
      if (unknown.length) throw new Error(`cms.tools() names content that is not in the config: ${unknown.join(', ')}.`);
      return readTools(ctx, createContentService(ctx), o.collections);
    },
    /** Whether the current request has a valid admin session (for your own routes). */
    isAdmin: () => isAdmin(ctx),
    handlers: createHandlers(ctx),
    AdminPage: createAdminPage(ctx),
    PreviewBanner: createPreviewBanner(ctx.apiPath),
  };
}
