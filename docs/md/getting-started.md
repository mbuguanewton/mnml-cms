---
title: "Getting started"
description: "Install mnml-cms in a Next.js site: the config, createCms, the admin and API routes, the proxy and the database table."
url: https://mnml-cms.vercel.app/getting-started
---

# Getting started

## Install

```sh
pnpm add @n3wtou/mnml-cms drizzle-orm
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | The shared admin password |
| `ADMIN_SESSION_SECRET` | Signs the session cookie. 32+ random characters. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token, for image uploads only ([Image storage](https://mnml-cms.vercel.app/image-storage.md)) |

## 1. Define your content

Plain data, safe to import anywhere.

```ts filename="mnml.config.ts"
import { collection, config, fields, singleton } from '@n3wtou/mnml-cms';

export default config({
  settings: singleton({ label: 'Settings', preview: '/', fields: { name: fields.text('Name', { required: true }) } }),
  posts: collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/blog', // served at /blog/<slug>
    preview: true, // live preview next to the editor
    fields: {
      title: fields.text('Title', { required: true }),
      date: fields.date('Date'),
      content: fields.richtext('Content'),
    },
  }),
});
```

## 2. Create the CMS

Server only.

```ts filename="src/mnml.ts"
import { createCms, neonDatabase, vercelBlobMedia } from '@n3wtou/mnml-cms/next';
import config from '../mnml.config';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL), // or any Drizzle Postgres database
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  media: vercelBlobMedia(), // optional
});
```

## 3. Mount the admin

```ts filename="app/admin/[[...path]]/page.tsx"
import { cms } from '@/mnml';
export default cms.AdminPage;
```

```ts filename="app/api/mnml/[...route]/route.ts"
import { cms } from '@/mnml';
export const { GET, POST } = cms.handlers;
```

```ts filename="proxy.ts"
import { adminProxy } from '@n3wtou/mnml-cms/proxy';
export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });
export const config = { matcher: ['/admin', '/admin/:path*'] };
```

Put the site's header and footer in a route group layout (e.g. `app/(site)/layout.tsx`) to keep them out of the admin.

## 4. Add the styles

In your global CSS:

```css
@import "@n3wtou/mnml-cms/styles.css";
```

Restyle the admin by overriding `--mnml-*` variables (see `styles.css`).

## 5. Create the table

Point drizzle-kit at the package's schema:

```ts filename="drizzle.config.ts"
export default defineConfig({ dialect: 'postgresql', schema: './node_modules/@n3wtou/mnml-cms/dist/server/content/db.js', dbCredentials: { url: process.env.DATABASE_URL! } });
```

Run `drizzle-kit push`. Scripts import the same table from `@n3wtou/mnml-cms/schema`.

## Help your AI agent

Add to your `AGENTS.md` or `CLAUDE.md`:

```md
Read node_modules/@n3wtou/mnml-cms/AGENTS.md before changing anything that uses mnml-cms.
```

- Every docs page is Markdown at its URL plus `.md`, e.g. [/agents.md](https://mnml-cms.vercel.app/agents.md). Index: [llms.txt](https://mnml-cms.vercel.app/llms.txt). Everything: [llms-full.txt](https://mnml-cms.vercel.app/llms-full.txt).
- With the [MCP server](https://mnml-cms.vercel.app/agents.md) on, the `docs` tool hands agents the right `.md` links.
