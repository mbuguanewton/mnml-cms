import 'server-only';
import type { CmsConfig } from '../define.js';
import { createAdminPage } from './admin-page.js';
import { isAdmin } from './auth.js';
import { createContext, type CmsOptions } from './context.js';
import { createHandlers } from './handlers.js';
import { createPreviewBanner } from './preview-banner.js';

export type { AdminPageDef, Change, CmsOptions } from './context.js';
export type { ReadOptions } from './store.js';
export { neonDatabase, type Database } from './db.js';
export { vercelBlobMedia, type MediaStorage } from './media.js';

/**
 * Set up the CMS for a Next.js app.
 *
 *   export const cms = createCms(config, { database, auth, media });
 *
 *   app/admin/[[...path]]/page.tsx   export default cms.AdminPage;
 *   app/api/cms/[...route]/route.ts  export const { GET, POST } = cms.handlers;
 *   app/(site)/layout.tsx            <cms.PreviewBanner />
 *   pages                            await cms.getEntry('posts', slug)
 */
export function createCms<C extends CmsConfig>(config: C, options: CmsOptions<C>) {
  const ctx = createContext(config, options);
  const { getSingleton, listEntries, getEntry, listSlugs } = ctx.store;
  return {
    config,
    getSingleton,
    listEntries,
    getEntry,
    listSlugs,
    /** Whether the current request has a valid admin session (for your own routes). */
    isAdmin: () => isAdmin(ctx),
    handlers: createHandlers(ctx),
    AdminPage: createAdminPage(ctx),
    PreviewBanner: createPreviewBanner(ctx.apiPath),
  };
}
