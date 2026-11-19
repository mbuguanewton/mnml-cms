# @n3wtou/mnml-cms

A small schema-driven CMS you embed in a Next.js site (App Router, v16+). One config file defines the
content, the admin is mounted at a route in your app, and entries are stored in your own Postgres in one
JSON table, so changing the content model never needs a migration.

Needs Next 16+, React 19+ and Tailwind v4. A complete app is in [`example/`](https://github.com/mbuguanewton/mnml-cms/tree/main/example).

```sh
pnpm add @n3wtou/mnml-cms drizzle-orm
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | The single admin password |
| `ADMIN_SESSION_SECRET` | Signs the session cookie; 32+ random characters |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token, only for image uploads (see [Image storage](https://DOCS_URL/image-storage)) |

## Set up

**1. Content model** (`mnml.config.ts`; plain data, safe to import anywhere):

```ts
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

**2. Wiring** (`src/mnml.ts`, server only):

```ts
import { createCms, neonDatabase, vercelBlobMedia } from '@n3wtou/mnml-cms/next';
import config from '../mnml.config';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL), // or any Drizzle Postgres database
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  media: vercelBlobMedia(), // optional: where uploaded images go
});
```

**3. Mount it:**

```ts
// app/admin/[[...path]]/page.tsx
import { cms } from '@/mnml';
export default cms.AdminPage;

// app/api/mnml/[...route]/route.ts
import { cms } from '@/mnml';
export const { GET, POST } = cms.handlers;

// proxy.ts
import { adminProxy } from '@n3wtou/mnml-cms/proxy';
export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });
export const config = { matcher: ['/admin', '/admin/:path*'] };
```

Keep the admin out of your site's header and footer by putting those in a route group layout, e.g.
`app/(site)/layout.tsx`.

**4. Styles** (your global CSS): `@import "@n3wtou/mnml-cms/styles.css";`. Restyle the admin by overriding
the `--mnml-*` variables (see `styles.css`).

**5. Database table:** point drizzle-kit at the package's schema and push it:

```ts
// drizzle.config.ts
export default defineConfig({ dialect: 'postgresql', schema: './node_modules/@n3wtou/mnml-cms/dist/server/db.js', dbCredentials: { url: process.env.DATABASE_URL! } });
```

Then run `drizzle-kit push`. `@n3wtou/mnml-cms/schema` exports the same table for scripts.

## Read an entry

```tsx
import { cms } from '@/mnml';
import { RichText } from '@n3wtou/mnml-cms/rich-text';

const post = await cms.getEntry('posts', slug); // fully typed from mnml.config.ts

<RichText content={post.content} className="prose" />
```

More readers (`listEntries`, `getEntries`, `getSingleton`, ordering and filters) are in
[Reading content](https://DOCS_URL/reading-content).

## Documentation

Everything else is in the docs at **https://DOCS_URL**:

- [Fields](https://DOCS_URL/fields): every field type, [limits](https://DOCS_URL/fields/limits), [blocks](https://DOCS_URL/fields/blocks),
  [select labels](https://DOCS_URL/fields/select-labels), [dates and times](https://DOCS_URL/fields/dates-and-times),
  [focal point](https://DOCS_URL/fields/focal-point), [default values](https://DOCS_URL/fields/default-values),
  [conditional fields](https://DOCS_URL/fields/conditional-fields), [derived values](https://DOCS_URL/fields/derived-values), [SEO](https://DOCS_URL/fields/seo)
- [Reading content](https://DOCS_URL/reading-content)
- [Drafts and publishing](https://DOCS_URL/drafts-and-publishing)
- [Moving content between databases](https://DOCS_URL/moving-content), including rehosting images
- [Extending the editor](https://DOCS_URL/editor): [tables](https://DOCS_URL/editor/tables), [nodes with a form](https://DOCS_URL/editor/nodes-with-a-form),
  [linking entries](https://DOCS_URL/editor/linking-entries), [custom node rendering](https://DOCS_URL/editor/custom-rendering)
- [Options](https://DOCS_URL/options)
- [Authentication](https://DOCS_URL/authentication)
- [Image storage](https://DOCS_URL/image-storage)
- [Other ORMs](https://DOCS_URL/other-orms)
- [Entry points](https://DOCS_URL/entry-points)
