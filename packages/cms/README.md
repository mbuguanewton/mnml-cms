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
| `datetime` | a moment in UTC, `string \| null` (`2026-11-18T14:30:00.000Z`); edited in the editor's time zone |
| `number(label, { min, max, step })` | `number \| null` |
| `boolean` | `boolean` (default `false`) |
| `select(label, ['a', 'b'] as const)` | `'a' \| 'b' \| null`; options can have labels (below) |
| `reference(label, 'authors')` | slug of a published entry in that collection, `string \| null`; resolve with `cms.getEntry` |
| `references(label, 'posts', { min, max })` | slugs of published entries, in the editor's order, `string[]`; resolve with `cms.getEntries` |
| `image` | `{ url, alt } \| null` |
| `richtext` | Tiptap JSON; render with `<RichText>` |
| `tags` | `string[]` |
| `array(label, fields, { itemLabel, min, max })` | a repeatable list of `fields` |
| `group(label, fields)` | a nested object shown as one section: `page.hero.headline` |
| `blocks(label, { hero: block('Hero', fields), … }, { itemLabel, min, max })` | a list of sections, each one of the blocks: `{ kind: 'hero', …its fields }[]` |
| `seo(label?)` | a `group` of `title`, `description` and `image` |

**Picking entries.** `reference` and `references` pick published entries with a search box: type to filter by title
or slug, use ↓/↑ and Enter, or click. A single `reference` shows the picked entry with a clear (×) button.

**Several references.** `references` stores an ordered list of slugs. The admin shows the picked entries (move up
or down, remove) and the search box to add more, limited by `max`. Validation trims slugs, drops blanks and repeats, then
checks `min` / `max`; `required` means at least one. A picked entry that is later unpublished stays in the list,
marked "(unavailable)", and readers leave it out.

```ts
related: fields.references('Related posts', 'posts', { max: 3 }),
authors: fields.references('Authors', 'authors', { required: true }),
```

Entries with groups get tabs above the form: **All fields**, **General** (fields outside any group) and one
tab per group. Use one singleton per page with groups as sections, or a collection when editors add pages.

### Limits

`array`, `blocks` and `references` take `min` and `max`: how many items they may have. `required` means at least
one. Saving with too few or too many fails with an error on the field ("Add at least 1 item"), and autosave pauses
with the same reason. At `max` the admin disables Add and says so. A field hidden by `showIf` skips the check.

```ts
links: fields.array('Links', { label: fields.text('Label'), url: fields.url('URL') }, { max: 4 }),
sections: fields.blocks('Sections', { hero, text }, { min: 1 }),
```

### Blocks

For pages made of different kinds of sections, give each kind its own fields:

```ts
sections: fields.blocks('Sections', {
  hero: block('Hero', { title: fields.text('Title'), image: fields.image('Image') }),
  posts: block('Posts', { count: fields.number('How many') }),
  divider: block('Divider', {}),
}),
```

Editors add a section from one "Add section" button that opens a list of the blocks (with a search box once
there are more than eight), and see only that block's fields. `block(label, fields, { description })` adds a one-line
hint to the list, and `fields.blocks(…, { addLabel })` renames the button. Each stored item carries its block's key as `kind`, and
reading narrows by it: `section.kind === 'hero'` gives `section.image`. `kind` is reserved, so no block can have
a field of that name. A stored item whose `kind` is no longer in the config is dropped on read, so removing
a block from the config removes it from the entries the next time they are saved.

### Select labels

Options are values, or values with the label the admin shows. The two forms mix, and the value type is still
inferred from the values:

```ts
category: fields.select('Category', ['news', { value: 'guide', label: 'How-to guide' }] as const), // 'news' | 'guide' | null
```

Entries, `default`, `showIf` and validation all use the values. To show the label on the site, use
`selectLabel(field, value)` with the field from your config: `selectLabel(config.posts.fields.category, post.category)`.
A value listed twice throws when the config loads.

### Dates and times

`date` is a calendar day (`YYYY-MM-DD`) with no time zone. `datetime` is a moment: it is stored in UTC in one
format (`2026-11-18T14:30:00.000Z`), so `listEntries({ orderBy })` sorts it in time. The admin shows and edits it in
the editor's own time zone and names that zone under the input. Values saved through the API need a `Z` or an
offset (`2026-11-18T17:30+03:00`); they are converted to UTC.

Show it on the site in the zone you choose; the server's zone is usually UTC:

```ts
new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(post.publishedAt));
```

`showIf` can test a `datetime` for a value or `{ empty: true }`; range conditions (`gt`, `lt`…) are for numbers.

### Default values

`default` sets the value a new entry, array item or block starts with. Pass a value, or a function that returns
one; it is type-checked against the field (a `select` default must be one of its options).

```ts
pageType: fields.select('Type', ['page', 'post'] as const, { default: 'page' }),
featured: fields.boolean('Featured', { default: false }),
date: fields.date('Date', { default: () => new Date().toISOString().slice(0, 10) }), // today
count: fields.number('How many', { default: 3 }),
```

- Defaults only apply when something is created: a new collection entry, a singleton that was never saved, an item
  added to an array, a block added to a `blocks` field. Reading an existing entry never applies them; a field
  missing from stored data still reads as its empty value.
- A function default runs when the entry form opens. Items and blocks added later in that form start with the
  value from when it opened (functions can't be sent to the browser).
- `text`, `textarea`, `number`, `boolean`, `select`, `date`, `datetime`, `url`, `reference`, `references` and `tags` take a
  `default`. For a `group`, give its fields defaults.

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
const related = await cms.getEntries('posts', post.related); // [{ slug, entry }], in the order given
export const generateStaticParams = async () => (await cms.listSlugs('posts')).map((slug) => ({ slug }));

<RichText content={post.content} className="prose" />
```

`getEntries(collection, slugs)` reads several entries in one query: published ones only, in the order of `slugs`,
leaving out missing, unpublished and repeated slugs. Use it to resolve a `references` field.

`listEntries` options: `orderBy` (a field, a derived value, `'slug'`, `'createdAt'` or `'updatedAt'`; default `'slug'`,
empty values last), `order` (`'asc'` | `'desc'`), `filter(entry)`, `limit`, `offset`.

Render `<cms.PreviewBanner />` in the site layout for live preview. It only appears for editors previewing,
and pages stay static for everyone else. Saving revalidates the whole site by default
(`revalidatePath('/', 'layout')`); pass `revalidate` to change that.

## Drafts and publishing

Collection entries are drafts or published, shown in the admin as a dot: green (published), grey (draft), or
orange over green (published, with changes that aren't live yet).

Edits to an existing entry **autosave** about a second and a half after you stop typing ("Saving…" / "Saved" in
the header), so there is no save button for drafts:

- **Publish** makes the draft the live version.
- **Discard changes** (in the "⋮" menu) throws the unpublished changes away and brings back the live version.
- **Unpublish** (in the "⋮" menu) takes a published entry off the site; its content becomes a draft.

A new entry has nothing to autosave into yet: **Create draft** stores it (or **Publish** goes live straight away),
and it autosaves from then on.

Autosave only stores valid data. While a field is invalid or a required one is empty, the header says
"Not saved: <field>: <problem>" and the edits since the last good state are only in the browser (leaving the
page warns first). Publish can therefore never fail on a stored draft.

If someone else changed the entry since you opened it, autosave stops and asks you to reload instead of
overwriting their version.

The public readers (`listEntries`, `getEntry`, `getEntries`, `listSlugs`) only return published entries, so a draft is a 404
on your site; editors see their autosaved draft in live preview, and anywhere on the site while Draft Mode is on
for that entry (until they press "Exit preview").

Singletons are always live by default: their Save publishes straight away. Give one `drafts: true` to make it
behave like a collection entry, with autosave, Publish and Discard changes:

```ts
settings: singleton({ label: 'Settings', drafts: true, fields: { /* … */ } }),
```

## Moving content between databases

Seed production from your dev content, or pull production back into dev. `@n3wtou/mnml-cms/sync` exports
the content to a JSON file, compares a file with a database, and writes the difference. It runs from a plain
script (no Next.js): the example has one, `scripts/content.ts`, behind `pnpm db:export`, `db:import` and
`db:sync`.

```sh
pnpm db:export                                                # DATABASE_URL → mnml-content.json
pnpm db:import mnml-content.json --mode add                   # dry run against DATABASE_URL
pnpm db:sync --from DATABASE_URL --to PROD_DATABASE_URL --mode add --apply --yes
pnpm db:sync --from-env-file .env.local --to-env-file .env.production --mode add --apply --yes
```

`--env`, `--from` and `--to` name an environment variable that holds a database URL (put them in `.env.local`),
so the URL itself never lands in your shell history. `--env-file`, `--from-env-file` and `--to-env-file` read the
variable (still `DATABASE_URL` unless you also name one) from a file instead, so dev and prod can each keep their
own `DATABASE_URL`. The file is only read, never loaded into the environment, and a `BLOB_READ_WRITE_TOKEN` in
the target's file is used for the missing-image check. The modes:

| `--mode`    | What it does                                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| `add`       | Adds the entries the target doesn't have. Existing ones are left alone.       |
| `overwrite` | Also replaces entries that differ.                                            |
| `replace`   | Makes the target match the file, deleting entries the file doesn't have.      |

Every run is a dry run that lists what would change, until you add `--apply`. Writing to a database that isn't
on localhost also needs `--yes`. Before it writes, it saves the target's current content to
`.mnml-backups/` (undo with `db:import <backup> --mode replace`). Entries are checked against your config first,
and nothing is written if any don't fit. The same database can't be both source and target, and running an
import twice is safe.

What travels: the config's collections and singletons, and their autosaved drafts. What doesn't: sign-in state,
preview copies, and **uploaded images**. The script lists any file the content uses that the target's media
storage doesn't have, so an image uploaded in dev is broken in prod until the file is copied. Writes aren't
atomic (the Neon HTTP driver has no transactions): if a run stops halfway, run it again. `createdAt` and
`updatedAt` on the target are set when written.

The same functions are exported for your own scripts: `exportContent`, `planImport`, `applyImport`,
`describePlan`, `missingMedia`, and `drizzleStorage` / `neonDatabase` to connect.

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
  run: (editor: Editor, admin: ToolContext) => void; // admin: form(), confirm(), alert() (see below)
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

### Nodes with a form

For a node whose values the editor fills in (an embed's URL, a callout's tone), `tools.node()` makes a button that
opens a form in the admin's dialog, validates it like an entry, then inserts the node. In the editor the node shows
as a card with a one-line preview; double-click it (or its Edit button) to change the values.

Define the node once, with its form fields, in a plain module that both the editor config and the site import.
`nodeAttributes(fields)` gives it one attribute per field, starting at the field's empty value and kept in HTML as
`data-<name>`:

```ts
// src/youtube.ts
import { Node } from '@tiptap/core';
import { fields } from '@n3wtou/mnml-cms';
import { nodeAttributes } from '@n3wtou/mnml-cms/editor';

export const youtubeFields = {
  url: fields.url('YouTube URL', { required: true }),
  title: fields.text('Title'),
};

export const YouTube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true, // a form node has no editable content of its own
  addAttributes: () => nodeAttributes(youtubeFields),
  parseHTML: () => [{ tag: 'div[data-youtube]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-youtube': '', ...HTMLAttributes }],
});
```

```tsx
// src/mnml-editor.tsx
export const editor = defineEditor({
  extensions: [YouTube],
  tools: [
    tools.node({
      name: 'youtube', // the node's name
      label: 'YouTube video',
      icon: <CirclePlayIcon />,
      group: 'insert',
      fields: youtubeFields,
      preview: (attrs) => attrs.url ?? '', // optional: the card's one-line preview
    }),
  ],
  components: { youtube: YouTubeEmbed }, // how <RichText> renders it on the site (see below)
});
```

Form fields can be `text`, `textarea`, `url`, `number`, `boolean`, `select`, `date` and `reference` (the slug): values
that fit in a node's attributes. `required`, `help` and `showIf` work as in entries.

The form is available to any tool: `run` gets the editor and the admin's dialogs.

```ts
run: async (editor, { form, confirm, alert }) => {
  const values = await form({ title: 'Callout', fields: calloutFields, submitLabel: 'Insert' }); // null if cancelled
  if (values) editor.chain().focus().insertContent({ type: 'callout', attrs: values }).run();
};
```

### Linking entries from rich text

`tools.reference()` is a button that picks a published entry of a collection and inserts a node that links to it:
`{ type: name, attrs: { collection, slug } }`. `referenceNode({ name })` is a ready-made node for it. In the editor it
shows as a card with the entry's title; double-click it to pick another entry.

```tsx
// src/mnml-editor.tsx
import { defineEditor, referenceNode, tools } from '@n3wtou/mnml-cms/editor';

export const editor = defineEditor({
  extensions: [referenceNode({ name: 'blockLink' })],
  tools: [tools.reference({ name: 'blockLink', label: 'Link a post', icon: <FileSymlinkIcon />, collection: 'posts', group: 'insert' })],
});
```

The node stores the slug only, so the site loads the linked entries itself. `collectReferences(doc)` lists every entry a
document links to, as `{ collection, slugs }[]` (deduplicated, found anywhere in the document), so you can load them
in one go before rendering, then render the node with a component:

```tsx
import { collectReferences, RichText } from '@n3wtou/mnml-cms/rich-text';

const slugs = collectReferences(post.content, ['blockLink']).find((r) => r.collection === 'posts')?.slugs ?? [];
const linked = new Map((await cms.getEntries('posts', slugs)).map((p) => [p.slug, p.entry]));

<RichText
  content={post.content}
  editor={editor}
  components={{ blockLink: ({ attrs }) => <PostCard slug={String(attrs.slug)} post={linked.get(String(attrs.slug))} /> }}
/>;
```

A linked entry can be unpublished or deleted later, so the component should handle a missing entry (the example
renders nothing). Node forms (`tools.node`) can also use a `reference` field; the picker offers published entries.

### Custom node rendering

By default `<RichText>` renders every node with its extension's `renderHTML`. To render a node with your own React
component (an embed, a highlighted code block, a callout, a card for another entry), map its name to a component.
The component gets the node as Tiptap JSON, its `attrs`, and its rendered content as `children` (none for leaf
nodes such as images):

```tsx
// src/components/code-block.tsx
import type { RichTextNodeProps } from '@n3wtou/mnml-cms/editor';

export function CodeBlock({ attrs, children }: RichTextNodeProps) {
  return (
    <figure>
      <figcaption>{String(attrs.language ?? '')}</figcaption>
      <pre><code>{children}</code></pre>
    </figure>
  );
}
```

Set it once in the editor config, so every `<RichText editor={editor}>` uses it:

```ts
// src/mnml-editor.ts
export const editor = defineEditor({
  components: { codeBlock: CodeBlock }, // keyed by node name: codeBlock, image, blockquote, your own node's name…
});
```

Or pass `components` to one `<RichText>`. It is merged over the editor config's, and wins for the same node:

```tsx
<RichText content={post.content} editor={editor} components={{ blockLink: PostCard }} />
```

The editor config is also loaded by the admin's editor in the browser, so components set there are part of the
client bundle. Keep those to plain components, and put async server components (ones that load data, such as a
card that fetches the linked entry) in the `components` prop. Nodes without a component render as before, and a
component for a node the schema doesn't have is ignored.

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
  // Optional: these slugs' rows in one query (any order). Without it, getEntries reads the collection with readRows.
  readRowsBySlug?(collection: string, slugs: string[]): Promise<{ slug: string; data: unknown; status: string }[]>;
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
  readRowsBySlug: (collection, slugs) =>
    prisma.entry.findMany({ where: { collection, slug: { in: slugs } }, select: { slug: true, data: true, status: true } }),
};
```

`drizzle-orm` is still a peer dependency, so install it even when you pass `storage`.

## Entry points

| Import | Contents |
| --- | --- |
| `@n3wtou/mnml-cms` | Schema builders, validation, types, `seoMetadata` (framework-free) |
| `@n3wtou/mnml-cms/next` | `createCms`, `neonDatabase`, `drizzleStorage`, `vercelBlobMedia`, `localMedia` |
| `@n3wtou/mnml-cms/proxy` | `adminProxy` |
| `@n3wtou/mnml-cms/rich-text` | `RichText` server renderer, `collectReferences` |
| `@n3wtou/mnml-cms/editor` | `defineEditor`, ready-made `tools` (including `tools.node`, `tools.reference`), `nodeAttributes`, `referenceNode`, `collectReferences`, `RichTextComponents` / `RichTextNodeProps` types (server-safe) |
| `@n3wtou/mnml-cms/admin` | UI pieces for extra admin pages, `editorProvider` |
| `@n3wtou/mnml-cms/db` | Drizzle table for scripts and drizzle-kit |
| `@n3wtou/mnml-cms/styles.css` | Admin styles and `--mnml-*` variables |
