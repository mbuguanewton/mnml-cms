import 'server-only';
import type { CmsConfig } from '../schema/define.js';
import { createAdminPage } from './admin/admin-page.js';
import { isAdmin } from './auth/auth.js';
import { createContext, type CmsOptions } from './context.js';
import { createHandlers } from './admin/handlers.js';
import { createPreviewBanner } from './admin/preview-banner.js';

export type { AdminPageDef, AgentScope, AgentToken, Change, CmsOptions, ListAction, McpOptions } from './context.js';
export type { AuthAdapter, PasswordAuth } from './auth/auth.js';
export type { ListOptions, ReadOptions } from './content/store.js';
export { neonDatabase, type Database } from './content/db.js';
export type { EntryStorage, StoredRow } from './content/storage.js';
export { drizzleStorage } from './content/storage.js';
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
  const { getSingleton, listEntries, getEntry, getEntries, listSlugs } = ctx.store;
  return {
    config,
    getSingleton,
    listEntries,
    getEntry,
    getEntries,
    listSlugs,
    /** Whether the current request has a valid admin session (for your own routes). */
    isAdmin: () => isAdmin(ctx),
    handlers: createHandlers(ctx),
    AdminPage: createAdminPage(ctx),
    PreviewBanner: createPreviewBanner(ctx.apiPath),
  };
}
