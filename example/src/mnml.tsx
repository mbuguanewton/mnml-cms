import 'server-only';
import { DatabaseZapIcon, FileTextIcon, HouseIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { createCms, neonDatabase, vercelBlobMedia } from '@n3wtou/mnml-cms/next';
import config from '../mnml.config';
import { CacheTool } from './admin/cache-tool';
import { Editor } from './mnml-editor-client';
import { AdminUi } from './mnml-ui';

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
  // The site's own Select (shadcn) in the admin; see src/mnml-ui.tsx.
  ui: AdminUi,
  // An extra action in the posts list's bar (next to Publish, Unpublish and Delete): runs once for each selected post.
  listActions: {
    posts: [{ name: 'refresh', label: 'Refresh on site', run: ({ slug }) => revalidatePath(`/posts/${slug}`) }],
  },
  // An extra admin screen, built with the components from @n3wtou/mnml-cms/admin.
  pages: [{ path: 'cache', label: 'Cache', icon: <DatabaseZapIcon />, render: () => <CacheTool /> }],
  // The MCP server at /api/mnml/mcp, for agents such as Claude Code.
  // adminTokens: editors also create and revoke tokens under Agent access in /admin.
  mcp: { adminTokens: true, tokens: [{ name: 'agent', token: process.env.MNML_AGENT_TOKEN, scopes: ['read', 'draft', 'publish'] }] },
});
