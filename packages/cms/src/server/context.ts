import 'server-only';
import type { ComponentType, ReactNode } from 'react';
import type { CmsConfig } from '../define.js';
import type { AuthAdapter, PasswordAuth } from './auth.js';
import type { Database } from './db.js';
import { drizzleStorage, type EntryStorage } from './storage.js';
import { sessionCodec } from './session.js';
import { createStore } from './store.js';
import { localMedia, type MediaStorage } from './media.js';

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

/** Where entries are stored: a Drizzle database (the built-in adapter), or your own `EntryStorage`. */
type StorageOptions =
  | {
      /** A Drizzle Postgres database, or a function returning one (called on first use). */
      database: Database | (() => Database);
      /** Table name; defaults to 'entries'. */
      table?: string;
      storage?: never;
    }
  | {
      /** A custom adapter, e.g. for Prisma. See the README. */
      storage: EntryStorage;
      database?: never;
      table?: never;
    };

export type CmsOptions<C extends CmsConfig> = StorageOptions & {
  /** The built-in single shared password (pass the env values; they are only checked when used),
   *  or an `AuthAdapter` to use your own login. */
  auth: PasswordAuth | AuthAdapter;
  /** Where uploaded images are stored, e.g. vercelBlobMedia(). Served back at <apiPath>/media/<key>.
   *  Left out, `next dev` stores them in ./.mnml-uploads (localMedia()); in production the
   *  upload buttons report that uploads aren't configured. */
  media?: MediaStorage;
  /** Defaults: '/admin' and '/api/mnml'. Must match where the page and route files live. */
  adminPath?: string;
  apiPath?: string;
  /** Sidebar title. A function is called on each admin render (e.g. to read a name from a singleton). */
  brand?: string | (() => string | Promise<string>);
  /** Sidebar icons per singleton/collection, e.g. { posts: <FileTextIcon /> }. */
  icons?: Partial<Record<keyof C, ReactNode>>;
  /** Extra admin screens, listed in the sidebar. */
  pages?: AdminPageDef[];
  /** Extra extensions and toolbar buttons for the rich-text editor: the component from `editorProvider(config)`,
   *  exported from a 'use client' file. Pass the same config to `<RichText editor>`. */
  editor?: ComponentType<{ children: ReactNode }>;
  /** Called after each save or delete. Default: revalidatePath('/', 'layout'). */
  revalidate?: (change: Change) => void;
  /** Runs after the response is sent (via after()), e.g. to update a search index. */
  onChange?: (change: Change) => void | Promise<void>;
};

export function createContext<C extends CmsConfig>(config: C, options: CmsOptions<C>) {
  const db = options.database;
  const storage = options.storage ?? drizzleStorage(typeof db === 'function' ? db : () => db!, options.table);
  const media = options.media ?? (process.env.NODE_ENV === 'development' ? localMedia() : undefined);
  const authAdapter = 'isAdmin' in options.auth ? options.auth : null;
  const adminPath = options.adminPath ?? '/admin';
  return {
    config,
    options: { ...options, media },
    storage,
    store: createStore(config, storage),
    authAdapter,
    session: sessionCodec(authAdapter ? undefined : (options.auth as PasswordAuth).secret),
    adminPath,
    apiPath: options.apiPath ?? '/api/mnml',
    /** Where signed-out visitors go. */
    // With an adapter's own `login` UI it is the admin's login page; otherwise the adapter's `loginUrl` ('/' if it gave neither).
    loginUrl: authAdapter ? (authAdapter.loginUrl ?? (authAdapter.login ? `${adminPath}/login` : '/')) : `${adminPath}/login`,
  };
}

export type Context<C extends CmsConfig = CmsConfig> = ReturnType<typeof createContext<C>>;
