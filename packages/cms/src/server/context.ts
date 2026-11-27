import 'server-only';
import type { ComponentType, ReactNode } from 'react';
import type { CmsConfig } from '../schema/define.js';
import type { AuthAdapter, PasswordAuth } from './auth/auth.js';
import type { Database } from './content/db.js';
import { drizzleStorage, type EntryStorage } from './content/storage.js';
import { sessionCodec } from './auth/session.js';
import { createStore } from './content/store.js';
import type { BrandOption } from './admin/brand.js';
import type { CacheOption } from './content/cached-store.js';
import { localMedia, type MediaStorage } from './media/media.js';
import { buildSearch } from './search/search.js';
import type { SearchOptions } from './search/types.js';
import type { AiOptions } from './ai/types.js';

/** A save or delete that reached the site. `by` is the agent token's name when the MCP server made it. */
export type Change = { type: 'save' | 'delete'; key: string; slug: string; by?: string };

/**
 * What an agent token may do. `read`: schema, entries, search, diffs, preview links. `draft`: create entries and save
 * drafts (never live), upload images. `publish`: publish, unpublish, discard drafts, and edit singletons without
 * drafts (those go live). `delete`: delete entries.
 */
export type AgentScope = 'read' | 'draft' | 'publish' | 'delete';

export type AgentToken = {
  /** Shown to `onChange` as `change.by`. Default 'agent'. */
  name?: string;
  /** The secret, e.g. process.env.MNML_AGENT_TOKEN. A token left unset is ignored. Use 32+ random characters. */
  token: string | undefined;
  /** Default ['read', 'draft']. */
  scopes?: AgentScope[];
  /** Limit the token to these singletons and collections. Default: all of them. */
  collections?: string[];
};

/** The MCP server at <apiPath>/mcp, for AI agents. Off unless set. */
export type McpOptions = {
  /** Tokens from your config (env vars). Good for CI and scripts. */
  tokens?: AgentToken[];
  /** Lets signed-in editors create and revoke tokens on an "Agent access" page in the admin. Stored hashed. */
  adminTokens?: boolean;
};

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

/**
 * An action a site adds to the collection list's bar (next to Publish, Unpublish and Delete). It runs once for each
 * selected entry, on the server; a thrown error marks that entry as failed and the message is shown.
 */
export type ListAction = {
  /** Unique in its collection, and not publish, unpublish or delete. */
  name: string;
  label: string;
  /** Styles the button as destructive. */
  danger?: boolean;
  /** Asks first, with this text (the admin adds how many entries are selected). */
  confirm?: string;
  /** `entry` is the entry's latest stored data (unpublished changes included). */
  run: (target: { key: string; slug: string; entry: Record<string, unknown> }) => void | Promise<void>;
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
  /**
   * The name (and logo) shown in the sidebar and on the sign-in page: a string, `{ name, logo }`, or a function returning
   * either (called on each admin render, e.g. to read a name from a singleton).
   */
  brand?: BrandOption | (() => BrandOption | Promise<BrandOption>);
  /** Sidebar icons per singleton/collection, e.g. { posts: <FileTextIcon /> }. */
  icons?: Partial<Record<keyof C, ReactNode>>;
  /** Actions for the collection list's bar, per collection key: `{ posts: [{ name: 'feature', label: 'Mark featured', run }] }`. */
  listActions?: Partial<Record<keyof C & string, ListAction[]>>;
  /** Extra admin screens, listed in the sidebar. */
  pages?: AdminPageDef[];
  /** Extra extensions and toolbar buttons for the rich-text editor: the component from `editorProvider(config)`,
   *  exported from a 'use client' file. Pass the same config to `<RichText editor>`. */
  editor?: ComponentType<{ children: ReactNode }>;
  /** A site's own components for the admin's Button, Input, Select… slots: the component from `uiProvider(slots)`,
   *  exported from a 'use client' file. Slots left out use the built-in ones. */
  ui?: ComponentType<{ children: ReactNode }>;
  /**
   * Caches the public readers across requests (`cms.getEntry`, `listEntries`…), until a save or delete changes that
   * collection. `{ revalidate }` sets the longest a read may live, in seconds (default 3600): the limit for content
   * written outside the CMS (scripts, SQL). Off by default; recommended. Draft Mode and the admin always read fresh.
   */
  cache?: CacheOption;
  /**
   * Search over published content, for agents and RAG: `cms.search(query)` and a `search_content` tool on the MCP
   * server. The package cuts entries into passages and keeps `index` in step; the index (Postgres full-text, pgvector,
   * Mongo, Convex, Algolia…) is yours: see the docs for examples. Works with any `storage`.
   */
  search?: SearchOptions;
  /**
   * The editing assistant: a chat panel in the admin that knows the open page, answers questions about the content
   * and fills fields for the editor to review. `model` is your adapter over a provider's API (Anthropic, OpenAI,
   * Gemini…): see the docs for examples. The assistant can read content but never saves, publishes or deletes.
   */
  ai?: AiOptions;
  /** Called after each save or delete. Default: revalidatePath('/', 'layout'). */
  revalidate?: (change: Change) => void;
  /** Turns on the MCP server at <apiPath>/mcp, so agents (Claude Code, Cursor…) can manage content with a token. */
  mcp?: McpOptions;
  /** Runs after the response is sent (via after()), e.g. to update a search index. */
  onChange?: (change: Change) => void | Promise<void>;
};

export function createContext<C extends CmsConfig>(config: C, options: CmsOptions<C>) {
  const db = options.database;
  const storage = options.storage ?? drizzleStorage(typeof db === 'function' ? db : () => db!, options.table);
  const media = options.media ?? (process.env.NODE_ENV === 'development' ? localMedia() : undefined);
  const authAdapter = 'isAdmin' in options.auth ? options.auth : null;
  const searchOptions = options.search ?? null;
  const routeKeys = Array.isArray(searchOptions?.route) ? searchOptions.route : [];
  for (const k of routeKeys) if (!Object.hasOwn(config, k)) throw new Error(`search.route lists "${k}", which is not in the config.`);
  const search = searchOptions ? buildSearch({ config, storage, index: searchOptions.index }) : null;
  if (options.ai && typeof options.ai.model?.stream !== 'function') throw new Error('ai.model needs a stream() method. See the docs for example adapters.');
  if ((options.ai?.name?.length ?? 0) > 40) throw new Error('ai.name is up to 40 characters.');
  if ((options.ai?.tone?.length ?? 0) > 300) throw new Error('ai.tone is up to 300 characters.');
  const adminPath = options.adminPath ?? '/admin';
  return {
    config,
    options: { ...options, media },
    storage,
    store: createStore(config, storage),
    // What the site's pages read: a stored value that doesn't fit its field reads as empty.
    readers: createStore(config, storage, { fit: true }),
    /** The search index, or null when `search` is off. */
    search,
    /** The assistant's model, or null when `ai` is off. */
    ai: options.ai ?? null,
    /** `search.route`: off (false), on for everything (true), or the collections it may search. */
    searchRoute: searchOptions?.route ?? false,
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
