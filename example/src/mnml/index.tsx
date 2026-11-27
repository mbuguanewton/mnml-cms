import 'server-only';
import { DatabaseZapIcon, FileTextIcon, HouseIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { jsonSchema, tool } from 'ai';
import { assistant } from '@n3wtou/mnml-cms/ai';
import { createCms, neonDatabase, vercelBlobMedia } from '@n3wtou/mnml-cms/next';
import config from '../../mnml.config';
import { CacheTool } from '../admin/cache-tool';
import { Editor } from './editor-client';
import { postgresAssistantStore } from './postgres-assistant-store';
import { postgresSearch } from './postgres-search';
import { AdminUi } from './ui';

// The assistant's model. With a Vercel AI Gateway key it is just an id; without one, Gemini directly with its own
// provider package. Neither key set: no assistant.
const gemini = process.env.GEMINI_KEY ?? process.env.GEMINI_API_KEY;
const model = process.env.AI_GATEWAY_API_KEY
  ? 'google/gemini-2.5-flash'
  : gemini
    ? createGoogleGenerativeAI({ apiKey: gemini })('gemini-2.5-flash')
    : undefined;

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL),
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  // Vercel Blob when a token is set; otherwise `next dev` falls back to local disk (./.mnml-uploads).
  media: process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobMedia() : undefined,
  // Published reads are kept between requests, and dropped on each save or delete.
  cache: true,
  // The sidebar and sign-in page show the logo (a different file in the dark theme) next to the name.
  brand: { name: 'Example', logo: { src: '/logo.svg', dark: '/logo-dark.svg' } },
  icons: { settings: <SettingsIcon />, home: <HouseIcon />, authors: <UserIcon />, posts: <FileTextIcon /> },
  editor: Editor,
  // The site's own Select (shadcn) in the admin; see src/mnml/ui.tsx.
  ui: AdminUi,
  // An extra action in the posts list's bar (next to Publish, Unpublish and Delete): runs once for each selected post.
  listActions: {
    posts: [{ name: 'refresh', label: 'Refresh on site', run: ({ slug }) => revalidatePath(`/posts/${slug}`) }],
  },
  // An extra admin screen, built with the components from @n3wtou/mnml-cms/admin.
  pages: [{ path: 'cache', label: 'Cache', icon: <DatabaseZapIcon />, render: () => <CacheTool /> }],
  // Search over published content: cms.search(), the search_content MCP tool and GET /api/mnml/search (`route`, limited to
  // these collections). The index is yours: postgres-search.ts is Postgres full-text; pgvector-search.ts adds meaning.
  search: { index: postgresSearch(process.env.DATABASE_URL), route: ['posts', 'pages'] },
  // The assistant: a chat panel in the admin that answers from the content and fills fields for review. `model` is a
  // Gateway id or an AI SDK model; `tools` adds the site's own (read-only here: it counts what is published).
  ai: model
    ? assistant({
        model,
        name: 'Scribe',
        tone: 'Friendly and concise. Plain words, no jargon.',
        // What the assistant did, in Postgres (postgres-assistant-store.ts). MNML_ASSISTANT_HISTORY=server also reads the
        // History menu from the table; by default the panel keeps its chat list in the browser.
        store: process.env.DATABASE_URL
          ? postgresAssistantStore(process.env.DATABASE_URL, { turns: process.env.MNML_ASSISTANT_HISTORY === 'server' })
          : undefined,
        tools: {
          site_counts: tool({
            description: 'How many published posts and pages the site has.',
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            // The type is written out because `cms` is the value this call is part of.
            execute: async (): Promise<{ posts: number; pages: number }> => ({
              posts: (await cms.listSlugs('posts')).length,
              pages: (await cms.listSlugs('pages')).length,
            }),
          }),
        },
      })
    : undefined,
  // The MCP server at /api/mnml/mcp, for agents such as Claude Code.
  // adminTokens: editors also create and revoke tokens under Agent access in /admin.
  mcp: { adminTokens: true, tokens: [{ name: 'agent', token: process.env.MNML_AGENT_TOKEN, scopes: ['read', 'draft', 'publish'] }] },
});
