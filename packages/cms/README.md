# @newtou/mnml-cms

A small schema-driven CMS you embed in a Next.js (App Router, v16+) site: one config file defines the
content, the admin UI is mounted at a route in your app, and content is stored in your own Postgres
(one JSON table, no migrations when the model changes).

## Quick start (5 minutes)

```sh
pnpm add @newtou/mnml-cms drizzle-orm   # needs Next 16+, React 19+, Tailwind v4
```

Then follow **Set up** below (config, `src/cms.tsx`, two routes, proxy, CSS, table) and set:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon by default) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token, only for image uploads |
| `ADMIN_PASSWORD` | The single admin password |
| `ADMIN_SESSION_SECRET` | Signs the session cookie; 32+ random characters |

A complete working app is in [`example/`](../../example). No `transpilePackages` is needed: the package
ships compiled ESM with types.

## Not yet

- No CLI or `init` command; setup is manual.
- Tailwind v4 is required for the admin styles.
- Single-password auth only.
- Postgres only (any Drizzle Postgres database; Neon over HTTP is the bundled default).
- Neon and Vercel Blob adapters are bundled as dependencies even if you use neither.
- Untested outside the site it was extracted from until it is published.

## Set up

**1. Content model** (`cms.config.ts`; plain data, safe to import anywhere):

```ts
import { collection, config, fields, singleton } from '@newtou/mnml-cms';

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
      tags: fields.tags('Tags'),
      authors: fields.array('Authors', { name: fields.text('Name') }, { itemLabel: 'name' }),
      content: fields.richtext('Content'),
    },
  }),
});
```

Field types: `text`, `textarea`, `date`, `url`, `image`, `richtext`, `tags`, `array`. Options: `{ required, help }`.

**2. Wiring** (`src/cms.ts`, server only):

```ts
import { createCms, neonDatabase, vercelBlobMedia } from '@newtou/mnml-cms/next';
import config from '../cms.config';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL), // or any Drizzle Postgres database
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  media: vercelBlobMedia(), // optional: where uploaded images go (a private store is fine)
});
```

**3. Mount it** (three small files):

```ts
// app/admin/[[...path]]/page.tsx
import { cms } from '@/cms';
export default cms.AdminPage;

// app/api/cms/[...route]/route.ts
import { cms } from '@/cms';
export const { GET, POST } = cms.handlers;

// proxy.ts
import { adminProxy } from '@newtou/mnml-cms/proxy';
export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });
export const config = { matcher: ['/admin', '/admin/:path*'] };
```

**4. Styles** (your global CSS, Tailwind v4): `@import "@newtou/mnml-cms/styles.css";`
Restyle the admin by overriding the `--cms-*` variables (see `styles.css`).

**5. Database table:** point drizzle-kit at the package's schema and push it:

```ts
// drizzle.config.ts
export default defineConfig({ dialect: 'postgresql', schema: './node_modules/@newtou/mnml-cms/dist/server/db.js', dbCredentials: { url: process.env.DATABASE_URL! } });
```

then `drizzle-kit push`. (`@newtou/mnml-cms/schema` exports the same table for scripts.)

## Use the content

```tsx
import { cms } from '@/cms';
import { RichText } from '@newtou/mnml-cms/rich-text';

const settings = await cms.getSingleton('settings');
const posts = await cms.listEntries('posts'); // [{ slug, entry }], fully typed
const post = await cms.getEntry('posts', slug);
export const generateStaticParams = async () => (await cms.listSlugs('posts')).map((slug) => ({ slug }));

<RichText content={post.content} className="prose" />
```

For live preview, render `<cms.PreviewBanner />` in the site layout. It only appears for editors
previewing, and pages stay static for everyone else.

Saving revalidates the whole site by default (`revalidatePath('/', 'layout')`); pass `revalidate`
to change that.

## Options

| Option | Purpose |
| --- | --- |
| `database` | A Drizzle Postgres database, or a function returning one (called on first use). |
| `table` | Table name (default `entries`). |
| `auth` | `{ password, secret }` for the built-in single-password login. |
| `media` | Storage for uploaded images, e.g. `vercelBlobMedia()`. See below. |
| `adminPath`, `apiPath` | Default `/admin` and `/api/cms`; must match where the files live. |
| `brand` | Sidebar title: a string or (async) function. |
| `icons` | Sidebar icons per key, e.g. `{ posts: <FileTextIcon /> }`. |
| `pages` | Extra admin screens: `{ path, label, group?, icon?, render }`. Build them with `@newtou/mnml-cms/admin` (`AdminHeader`, `Button`, `cardClass`…). |
| `revalidate` | Called after each save/delete. |
| `onChange` | Runs after the response on each save/delete (via `after()`), e.g. to update a search index. |

`cms.isAdmin()` checks the session in your own routes.

## Image storage

Uploaded images are stored through a `MediaStorage` adapter and served by the CMS at
`<apiPath>/media/<key>`, so the store itself can be private and any backend works. Responses are
cached for a year (keys are unique), so the storage is read about once per image.

```ts
type MediaStorage = {
  put(file: File, name: string): Promise<string>; // store, return a unique key
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType?: string; size?: number } | null>;
};
```

`vercelBlobMedia({ prefix = 'cms/', access = 'private', token })` is included. It only serves keys
under `prefix`, so other files in the same store stay private. For S3, R2 or anything else, implement
the two methods.

## Entry points

| Import | Contents |
| --- | --- |
| `@newtou/mnml-cms` | Schema builders, validation, types (framework-free) |
| `@newtou/mnml-cms/next` | `createCms`, `neonDatabase`, `vercelBlobMedia` |
| `@newtou/mnml-cms/proxy` | `adminProxy` (kept separate so the proxy stays small) |
| `@newtou/mnml-cms/rich-text` | `RichText` server renderer |
| `@newtou/mnml-cms/admin` | UI pieces for extra admin pages |
| `@newtou/mnml-cms/db` | Drizzle table for scripts (drizzle-kit reads the built file, see above) |
| `@newtou/mnml-cms/styles.css` | Admin styles and `--cms-*` variables |

## Not yet

Pre-built CSS for sites without Tailwind v4, a CLI (`init`, `db push`, `seed`), a build step for
publishing to npm, and auth adapters for existing login systems.
