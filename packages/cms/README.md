# @n3wtou/mnml-cms

A small schema-driven CMS you embed in a Next.js site (App Router, v16+). One config file defines the
content, the admin is mounted at a route in your app, and entries are stored in your own Postgres in one
JSON table, so changing the content model never needs a migration.

Needs Next 16+, React 19+ and Tailwind v4. A complete app is in [`example/`](../../example).

```sh
pnpm add @n3wtou/mnml-cms drizzle-orm
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | The single admin password |
| `ADMIN_SESSION_SECRET` | Signs the session cookie; 32+ random characters |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token, only for image uploads (see [Image storage](#image-storage)) |

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

## Fields

Options for every field: `{ required, help }`.

| Field | Value |
| --- | --- |
| `text`, `textarea` | `string` |
| `date` (`YYYY-MM-DD`), `url` | `string \| null` |
| `number(label, { min, max, step })` | `number \| null` |
| `boolean` | `boolean` (default `false`) |
| `select(label, ['a', 'b'] as const)` | `'a' \| 'b' \| null` |
| `reference(label, 'authors')` | slug of a published entry in that collection, `string \| null`; resolve with `cms.getEntry` |
| `image` | `{ url, alt } \| null` |
| `richtext` | Tiptap JSON; render with `<RichText>` |
| `tags` | `string[]` |
| `array(label, fields, { itemLabel })` | a repeatable list of `fields` |
| `group(label, fields)` | a nested object shown as one section: `page.hero.headline` |
| `blocks(label, { hero: block('Hero', fields), … }, { itemLabel })` | a list of sections, each one of the blocks: `{ kind: 'hero', …its fields }[]` |
| `seo(label?)` | a `group` of `title`, `description` and `image` |

Entries with groups get tabs above the form: **All fields**, **General** (fields outside any group) and one
tab per group. Use one singleton per page with groups as sections, or a collection when editors add pages.

### Blocks

For pages made of different kinds of sections, give each kind its own fields:

```ts
sections: fields.blocks('Sections', {
  hero: block('Hero', { title: fields.text('Title'), image: fields.image('Image') }),
  posts: block('Posts', { count: fields.number('How many') }),
  divider: block('Divider', {}),
}),
```

Editors pick a block to add and see only its fields. Each stored item carries its block's key as `kind`, and
reading narrows by it: `section.kind === 'hero'` gives `section.image`. `kind` is reserved, so no block can have
a field of that name. A stored item whose `kind` is no longer in the config is dropped on read, so removing
a block from the config removes it from the entries the next time they are saved.

### Conditional fields

`showIf` on any field shows it only while its sibling fields (the ones next to it in the same entry, group,
array item or block) match:

```ts
type: fields.select('Type', ['post', 'link'] as const),
url: fields.url('URL', { required: true, showIf: { type: 'link' } }),
badge: fields.text('Badge', { showIf: { type: ['link', 'video'], price: { gt: 0 } } }), // every key must match
```

A condition is a value (equals), a list (any of), `{ not: … }`, a comparison (`gt`, `gte`, `lt`, `lte`) or
`{ empty: true | false }`. It is plain data rather than a function so the admin form can evaluate it as the editor
types. A condition that names something other than a sibling field throws when the config loads.

A hidden field isn't validated, so a hidden `required` field never blocks a save. Its stored value is kept (toggle
back and the text is still there), and readers still return it, so check the same condition when rendering.

### Derived values

A singleton or collection can compute extra values from its own fields. They run on every read, are never
stored, are typed from the function's return type, and work in `orderBy` and `filter`. The admin shows them
read-only in the form; wrap a function in `derive()` to choose where (`after` a field, default the end) and
its `label`.

```ts
import { collection, derive, readingTime } from '@n3wtou/mnml-cms';

posts: collection({
  // …
  derived: {
    readingTime: derive((post) => readingTime(post.content), { after: 'content' }),
    wordy: (post) => post.title.length > 60, // a plain function works too
  },
}),
```

They are pure functions of one entry and can't share a name with a field. `plainText(doc)` and
`readingTime(doc)` help with rich text.

### SEO

`seoMetadata(entry.seo, fallback)` returns Next.js `Metadata`; empty values fall back to `fallback`.

```ts
export const generateMetadata = async () => seoMetadata((await cms.getSingleton('home'))?.seo, { title: 'Home' });
```

## Reading content

```tsx
import { cms } from '@/mnml';
import { RichText } from '@n3wtou/mnml-cms/rich-text';

const settings = await cms.getSingleton('settings');
const posts = await cms.listEntries('posts'); // [{ slug, entry, status }], fully typed
const latest = await cms.listEntries('posts', { orderBy: 'date', order: 'desc', limit: 3 });
const post = await cms.getEntry('posts', slug);
export const generateStaticParams = async () => (await cms.listSlugs('posts')).map((slug) => ({ slug }));

<RichText content={post.content} className="prose" />
```

`listEntries` options: `orderBy` (a field, a derived value, `'slug'`, `'createdAt'` or `'updatedAt'`; default `'slug'`,
empty values last), `order` (`'asc'` | `'desc'`), `filter(entry)`, `limit`, `offset`.

Render `<cms.PreviewBanner />` in the site layout for live preview. It only appears for editors previewing,
and pages stay static for everyone else. Saving revalidates the whole site by default
(`revalidatePath('/', 'layout')`); pass `revalidate` to change that.

## Drafts and publishing

Collection entries are drafts or published, shown in the admin as a dot: green (published), grey (draft), or
orange over green (published, with saved changes that aren't live yet).

- **Save draft** keeps the edits off the site. On a published entry they are stored as pending changes and the
  live version stays as it was.
- **Publish** makes the form the live version.
- **Unpublish** (in the "⋮" menu) takes a published entry off the site; its content becomes a draft.

The public readers (`listEntries`, `getEntry`, `listSlugs`) only return published entries, so a draft is a 404
on your site; editors still see it in live preview. Singletons are always live.

## Extending the editor

Add Tiptap extensions and toolbar buttons with one config file and a 3-line client file. The editor runs in
the browser and `<RichText>` on the server, and both need the same extensions, so the config lives in a plain
module that both import:

```ts
// src/mnml-editor.ts (no 'use client')
import { defineEditor, tools } from '@n3wtou/mnml-cms/editor';

export const editor = defineEditor({
  extensions: [], // added to the defaults (StarterKit + Image)
  tools: [tools.underline, tools.strike, tools.horizontalRule],
});
```

```tsx
// src/mnml-editor-client.tsx
'use client';
import { editorProvider } from '@n3wtou/mnml-cms/admin';
import { editor } from './mnml-editor';
export const Editor = editorProvider(editor);
```

Then pass `editor: Editor` to `createCms`, and `editor={editor}` to every `<RichText>`:

```tsx
<RichText content={post.content} editor={editor} />
```

`tools.underline`, `tools.strike` and `tools.horizontalRule` are buttons for things StarterKit already has, so
they need no extension. A tool of your own is an object; the editor passed to `run`, `isActive` and `disabled`
is the live Tiptap editor:

```ts
type EditorTool = {
  name: string; // unique; the React key
  label: string; // tooltip and accessible name
  icon: ReactNode;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean; // shows the button as pressed
  disabled?: (editor: Editor) => boolean;
  group?: 'format' | 'block' | 'insert'; // toolbar group; left out, a group of its own at the end
};
```

The toolbar is grouped: undo and redo, the text style menu (paragraph, headings, quote), text formatting
(bold, italic, code), blocks (lists) and inserts (link, image). A tool with a `group` joins that group;
`tools.underline` and `tools.strike` go in `format`, `tools.horizontalRule` in `insert`.

**Example: code blocks with syntax highlighting.** StarterKit has a plain code block; swap it for
[`CodeBlockLowlight`](https://tiptap.dev/docs/editor/extensions/nodes/code-block-lowlight) and add a button.
To replace or remove a default, pass a function: it gets the defaults and returns the full list.

```tsx
// src/mnml-editor.tsx
import { defineEditor } from '@n3wtou/mnml-cms/editor';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SquareCodeIcon } from 'lucide-react';

export const editor = defineEditor({
  extensions: (defaults) => [
    ...defaults.map((ext) => (ext.name === 'starterKit' ? ext.configure({ codeBlock: false }) : ext)),
    CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
  ],
  tools: [
    {
      name: 'codeBlock',
      label: 'Code block',
      group: 'block',
      icon: <SquareCodeIcon />,
      isActive: (e) => e.isActive('codeBlock'),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
  ],
});
```

The highlighting is an editor decoration: `<RichText>` renders `<pre><code class="language-…">`, which you
highlight on the site with any highlighter (or style as plain code).

The config applies to every rich-text field. It can't be set per field, because extensions and functions can't
be stored in the schema that is sent to the admin.

## Options

| Option | Purpose |
| --- | --- |
| `database` | A Drizzle Postgres database, or a function returning one (called on first use). |
| `table` | Table name (default `entries`), with `database`. |
| `storage` | Instead of `database`: your own `EntryStorage` (see [Other ORMs](#other-orms)). |
| `auth` | `{ password, secret }` for the built-in single-password login, or an `AuthAdapter` (see [Authentication](#authentication)). |
| `media` | Storage for uploaded images (see [Image storage](#image-storage)). |
| `adminPath`, `apiPath` | Default `/admin` and `/api/mnml`; must match where the files live. |
| `brand` | Sidebar title: a string or (async) function. |
| `icons` | Sidebar icons per key, e.g. `{ posts: <FileTextIcon /> }`. |
| `pages` | Extra admin screens: `{ path, label, group?, icon?, render }`, built with `@n3wtou/mnml-cms/admin`. |
| `editor` | Extra editor extensions and toolbar buttons: the component from `editorProvider()` (see [Extending the editor](#extending-the-editor)). |
| `revalidate` | Called after each save or delete. |
| `onChange` | Runs after the response on each save or delete (via `after()`), e.g. to update a search index. |

`cms.isAdmin()` checks the session (built-in or your adapter) in your own routes.

Custom admin pages can open the admin's own dialogs from client components: `const { confirm, alert } = useAdmin()`
(from `@n3wtou/mnml-cms/admin`), e.g. `await confirm({ title: 'Delete?', description: '…', confirmLabel: 'Delete', danger: true })`
resolves to `true` or `false`.

## Authentication

**Built-in login** (`auth: { password, secret }`): one shared password.
- A client IP is locked out for 15 minutes after 5 failed sign-ins (counted in the entries table, so it works on serverless).
- Sessions last 24 hours from the last visit; the proxy renews the cookie while you're active.
- Changing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` signs everyone out, and the sidebar's **Sign out everywhere** does the same on demand.

**Your own login** (Auth.js, Better Auth, Clerk…): pass an adapter instead. Give it either a `login` UI or a
`loginUrl`.

```tsx
export const cms = createCms(config, {
  // …
  auth: {
    isAdmin: async () => (await auth.api.getSession({ headers: await headers() }))?.user.role === 'admin',
    login: <SignInWithSso />, // shown in the admin's login card at /admin/login
    // loginUrl: '/sign-in',  // or send signed-out visitors to a page of your own
    signOut: async () => { await auth.api.signOut({ headers: await headers() }); }, // optional
  },
});
```

`login` can be a server or client component; build it with `Button`, `inputClass` and friends from
`@n3wtou/mnml-cms/admin` to match the admin. The admin page and every API route call `isAdmin()`. Leave out
`adminProxy` in this case: it only understands the built-in session cookie.

## Image storage

Uploads go through a `MediaStorage` adapter and are served at `<apiPath>/media/<key>`, so the store itself can
be private. Responses are cached for a year.

```ts
type MediaStorage = {
  put(file: File, name: string): Promise<string>; // store, return a unique key
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType?: string; size?: number } | null>;
  list?(): Promise<{ key: string; size?: number; uploadedAt?: Date }[]>; // optional: powers the Media screen
  delete?(key: string): Promise<void>; // optional: enables Delete on the Media screen
};
```

When the storage has `list`, the admin gets a **Media** screen: every stored file with its size and date, the
entries that use it (image fields and images in rich text, including unpublished changes), an "Unused" flag
and a Delete button. Deleting warns first if the file is still in use. Both bundled adapters support it.

- `vercelBlobMedia({ prefix = 'cms/', access = 'private', token })` only serves keys under `prefix`.
- `localMedia({ dir = '.mnml-uploads' })` writes to disk. It is the default in `next dev` when you pass no
  `media`. Don't use it on serverless hosting; add the folder to `.gitignore`.
- For S3, R2 or anything else, implement the two methods.

## Other ORMs

Pass `storage` instead of `database` to use something other than Drizzle. It is five plain queries; the CMS
handles caching, sorting and drafts.

```ts
type EntryStorage = {
  readRow(collection: string, slug: string): Promise<{ data: unknown; status: string } | undefined>;
  readRows(collection: string): Promise<{ slug: string; data: unknown; status: string; createdAt: Date; updatedAt: Date }[]>;
  upsert(collection: string, slug: string, data: unknown, status: string): Promise<void>; // set updatedAt = now
  insertIfAbsent(collection: string, slug: string, data: unknown, status: string): Promise<boolean>; // false if the slug exists
  remove(collection: string, slug: string): Promise<void>;
};
```

Create the table yourself (keep these names):

```sql
create table entries (
  id serial primary key,
  collection text not null,
  slug text not null,
  data jsonb not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_collection_slug unique (collection, slug)
);
```

Prisma:

```prisma
model Entry {
  id         Int      @id @default(autoincrement())
  collection String
  slug       String
  data       Json
  status     String   @default("published")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")

  @@unique([collection, slug], name: "entries_collection_slug")
  @@map("entries")
}
```

```ts
const at = (collection: string, slug: string) => ({ entries_collection_slug: { collection, slug } });

const storage: EntryStorage = {
  async readRow(collection, slug) {
    return (await prisma.entry.findUnique({ where: at(collection, slug), select: { data: true, status: true } })) ?? undefined;
  },
  readRows: (collection) =>
    prisma.entry.findMany({ where: { collection }, select: { slug: true, data: true, status: true, createdAt: true, updatedAt: true } }),
  async upsert(collection, slug, data, status) {
    await prisma.entry.upsert({
      where: at(collection, slug),
      create: { collection, slug, data: data as object, status },
      update: { data: data as object, status },
    });
  },
  async insertIfAbsent(collection, slug, data, status) {
    const { count } = await prisma.entry.createMany({ data: [{ collection, slug, data: data as object, status }], skipDuplicates: true });
    return count > 0;
  },
  async remove(collection, slug) {
    await prisma.entry.deleteMany({ where: { collection, slug } });
  },
};
```

`drizzle-orm` is still a peer dependency, so install it even when you pass `storage`.

## Entry points

| Import | Contents |
| --- | --- |
| `@n3wtou/mnml-cms` | Schema builders, validation, types, `seoMetadata` (framework-free) |
| `@n3wtou/mnml-cms/next` | `createCms`, `neonDatabase`, `drizzleStorage`, `vercelBlobMedia`, `localMedia` |
| `@n3wtou/mnml-cms/proxy` | `adminProxy` |
| `@n3wtou/mnml-cms/rich-text` | `RichText` server renderer |
| `@n3wtou/mnml-cms/editor` | `defineEditor`, ready-made `tools` (server-safe) |
| `@n3wtou/mnml-cms/admin` | UI pieces for extra admin pages, `editorProvider` |
| `@n3wtou/mnml-cms/db` | Drizzle table for scripts and drizzle-kit |
| `@n3wtou/mnml-cms/styles.css` | Admin styles and `--mnml-*` variables |
