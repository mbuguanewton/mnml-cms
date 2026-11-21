---
name: mnml-getting-started
description: "mnml-cms setup in Next.js: config, createCms, admin/API routes, proxy, table. Also basics that break: server-only imports, image values, drafts 404ing."
---

<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

> Matches the installed version. Online: https://mnml-cms.vercel.app/getting-started

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
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token, for image uploads only ([Image storage](https://mnml-cms.vercel.app/image-storage)) |

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
export default defineConfig({ dialect: 'postgresql', schema: './node_modules/@n3wtou/mnml-cms/dist/server/db.js', dbCredentials: { url: process.env.DATABASE_URL! } });
```

Run `drizzle-kit push`. Scripts import the same table from `@n3wtou/mnml-cms/schema`.

## Help your AI agent

The package ships skills and an `AGENTS.md` matching the installed version. Add to your `AGENTS.md` or `CLAUDE.md`:

```md
Read node_modules/@n3wtou/mnml-cms/AGENTS.md before changing anything that uses mnml-cms.
```

Claude Code: link the skills so it finds them:

```sh
mkdir -p .claude/skills && for s in node_modules/@n3wtou/mnml-cms/skills/*; do ln -sfn "../../$s" ".claude/skills/$(basename "$s")"; done
```

Web agents: [llms.txt](https://mnml-cms.vercel.app/llms.txt), [llms-full.txt](https://mnml-cms.vercel.app/llms-full.txt).

## More

- [mnml-cms](references/index.md): A small schema-driven CMS that lives inside your Next.js site.
- [Entry points](references/entry-points.md): Every import path of @n3wtou/mnml-cms and what it contains.
- [Common mistakes](references/common-mistakes.md): The mistakes that cost the most time with mnml-cms, and how to avoid them.
