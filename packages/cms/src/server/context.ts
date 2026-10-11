import 'server-only';
import type { ReactNode } from 'react';
import type { CmsConfig } from '../define.js';
import type { Database } from './db.js';
import { sessionCodec } from './session.js';
import { createStore } from './store.js';
import type { MediaStorage } from './media.js';

export type Change = { type: 'save' | 'delete'; key: string; slug: string };

/** An extra screen in the admin, e.g. a settings page that isn't content. */
export type AdminPageDef = {
  /** URL segment under the admin path, e.g. 'knowledge' → /admin/knowledge. */
  path: string;
  label: string;
  /** Sidebar group heading; defaults to 'Tools'. */
  group?: string;
  icon?: ReactNode;
  render: () => ReactNode | Promise<ReactNode>;
};

export type CmsOptions<C extends CmsConfig> = {
  /** A Drizzle Postgres database, or a function returning one (called on first use). */
  database: Database | (() => Database);
  /** Table name; defaults to 'entries'. */
  table?: string;
  /** Single shared password login. Pass the env values; they are only checked when used. */
  auth: { password: string | undefined; secret: string | undefined };
  /** Where uploaded images are stored, e.g. vercelBlobMedia(). Served back at <apiPath>/media/<key>.
   *  Without it, image upload buttons report that uploads aren't configured. */
  media?: MediaStorage;
  /** Defaults: '/admin' and '/api/cms'. Must match where the page and route files live. */
  adminPath?: string;
  apiPath?: string;
  /** Sidebar title. A function is called on each admin render (e.g. to read a name from a singleton). */
  brand?: string | (() => string | Promise<string>);
  /** Sidebar icons per singleton/collection, e.g. { posts: <FileTextIcon /> }. */
  icons?: Partial<Record<keyof C, ReactNode>>;
  /** Extra admin screens, listed in the sidebar. */
  pages?: AdminPageDef[];
  /** Called after each save or delete. Default: revalidatePath('/', 'layout'). */
  revalidate?: (change: Change) => void;
  /** Runs after the response is sent (via after()), e.g. to update a search index. */
  onChange?: (change: Change) => void | Promise<void>;
};

export function createContext<C extends CmsConfig>(config: C, options: CmsOptions<C>) {
  const db = options.database;
  const getDb = typeof db === 'function' ? db : () => db;
  return {
    config,
    options,
    store: createStore(config, getDb, options.table),
    session: sessionCodec(options.auth.secret),
    adminPath: options.adminPath ?? '/admin',
    apiPath: options.apiPath ?? '/api/cms',
  };
}

export type Context<C extends CmsConfig = CmsConfig> = ReturnType<typeof createContext<C>>;
