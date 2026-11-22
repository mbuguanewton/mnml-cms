# Changelog

## 1.6.0

### Minor Changes

- 44084b0: Agent tokens from the admin. `mcp: { adminTokens: true }` adds an "Agent access" page in `/admin` where editors create MCP tokens (name, scopes, content), see when each was last used, and revoke them. A new token (`mnml_…`) is shown once, with a ready `claude mcp add` command; only its SHA-256 hash is stored, in the entries table (no migration). A revoked token gets 401 on its next request. `mcp.tokens` from the config keep working alongside, and names are unique across both. `mcp.tokens` is now optional.
- 5dd2f56: Own admin UI components, no new dependencies. `Select` (a keyboard listbox in a popover) replaces the native select. `Checkbox` and `Switch` replace native checkboxes (boolean fields, login, Agent access). Number, date and datetime inputs keep the browser's pickers but look the same in every browser, light and dark. Toolbar `title=` hints are now tooltips that also show on keyboard focus. Save results show as toasts, also on phones. `@n3wtou/mnml-cms/admin` exports `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Tooltip` and their prop types, and `useAdmin()` adds `toast()`, for custom admin pages. Not breaking: `--mnml-*` variables are unchanged; the new `mnml-input` class sits on inputs.
- 19ad194: New `ui` option: use your own components (e.g. shadcn) for the admin's Button, Input, Textarea, Select, Checkbox, Switch, Tooltip and Menu. Build it with `uiProvider(slots)` from `@n3wtou/mnml-cms/admin`; slots you leave out keep the built-in ones. On admin pages a token bridge points shadcn's variables (`--primary`, `--border`, `--popover`…) at the admin's `--mnml-*` tokens, so your components match the admin while the rest of your site keeps its theme. `useAdminPortal()` gives popovers a portal target inside the admin's modal dialogs. New `mnml-admin` class on the admin's root. Not breaking. See [Custom admin UI](https://mnml-cms.vercel.app/custom-admin-ui).
- f5110bb: Own date picker for `date` and `datetime` fields: type `YYYY-MM-DD` or pick from a calendar popover (arrows, Home/End, PageUp/PageDown by month, Shift by year, Enter, Escape). Impossible dates are marked invalid. Datetime fields take `YYYY-MM-DD HH:mm` in one box, with the time picked in the calendar (a time row with hour and minute lists, and Done; no native time popup); picking another day keeps the time. `DatePicker` takes `time` for a separate time box, or `time` + `timeInCalendar` for the combined one. Touch screens keep the browser's own picker. New `DatePicker` component and `DatePicker` slot for the `ui` option. No new dependencies (date maths on the existing `date-fns`). Not breaking.
- bfda5b0: Rich text editor: the toolbar stays on one row and tools that don't fit move into a "More tools" menu. New fullscreen mode (expand button at the toolbar's right end; Escape closes it) with the entry title and save status in its header and each tool's name shown next to its icon. The inline editor has a fixed height that scrolls and can be dragged taller, like a textarea. The image alt text input moved from the toolbar to its own bar under it. New `Menu` component (and `MenuProps`, `MenuAction` types) in `@n3wtou/mnml-cms/admin`. Not breaking.
- 990fba2: Admin collection lists page and search. 25 entries a page with Previous / Next and a "26–50 of 80" label; a search box filters by title or slug (case-insensitive) as you type, or on Enter without JavaScript. Page and search are in the URL (`?q=…&page=2`).

## 1.5.0

### Minor Changes

- 6ddceb3: Docs for agents, all generated from the docs site's pages.

  - Every docs page is served as Markdown at its URL plus `.md` (e.g. `/fields/blocks.md`), with `title`, `description` and `url` in its frontmatter. `/llms.txt` and `/llms-full.txt` list and bundle them.
  - MCP: a `docs` tool (scope `read`) returns the `.md` links of the pages matching a topic.
  - `AGENTS.md` in the package: where the types and docs are, and the rules agents break most.
  - New docs pages: "Common mistakes" and "Upgrading".

- 5dcf272: MCP: rich text as Markdown. Agents can send a Markdown string for any `richtext` field (nested ones too), and the server converts it to Tiptap JSON. Headings, bold, italic, strike, code, links, lists, quotes, code blocks, images and horizontal rules convert. Tables and raw HTML are refused with a field error; send Tiptap JSON for those. `get_entry` and `list_entries` take `richText: 'markdown'` to return rich text as Markdown. Nodes Markdown can't express come out as `<!-- mnml:<type> -->`, with `lossy: true`.

  `markdownToRichText` and `richTextToMarkdown` are exported from `@n3wtou/mnml-cms/sync` for import scripts.

  Fix: MCP `publish` and `unpublish` no longer fail on entries saved before a field was added.

  New dependency: `@tiptap/markdown`. Not breaking.

- 2d3b79f: MCP server for agents. Set `mcp: { tokens: [{ name, token, scopes, collections }] }` in `createCms` to serve it at `<apiPath>/mcp` (Streamable HTTP). Agents authenticate with a bearer token, separate from the admin login. Scopes are `read`, `draft` (the default with `read`), `publish` and `delete`, and a token can be limited to some collections. Tools: `get_schema`, `list_entries`, `get_entry`, `search`, `create_entry`, `update_entry`, `validate_entry`, `diff_entry`, `publish`, `unpublish`, `discard_draft`, `delete_entry`, `upload_media_from_url` and `get_preview_url`. Agent writes are drafts. They use the same validation and write path as the admin. `delete_entry` and `discard_draft` only make a request: the entry page in the admin shows it, and an editor approves or rejects it there. A discard is refused if the draft changed after the request. Like admin saves, everything except pending edits to a published entry runs `revalidate` and `onChange` (creating a draft, publishing, unpublishing, deleting), with `change.by` set to the token's name. `upload_media_from_url` only fetches public https hosts, checked again on every redirect.

  Also new: `listEntries` returns `createdAt` and `updatedAt` for each entry. `<apiPath>/preview/open?key=&slug=` opens an entry's latest version in Draft Mode, for signed-in admins only.

  Not breaking. No database change.

## 1.4.1

### Patch Changes

- 0a01846: The README now covers install and setup only; the full documentation moved to the docs site at https://mnml-cms.vercel.app, which is also the package's `homepage`.

## 1.4.0

### Minor Changes

- 20c226a: New `fields.datetime(label)`: a moment in time, stored in UTC as one ISO format (`2026-11-18T14:30:00.000Z`), so `orderBy` sorts it chronologically. The admin edits it with a `datetime-local` input in the editor's time zone and names that zone. Saved values need a `Z` or an offset and are converted to UTC; impossible dates are rejected. Works with `default` (e.g. `() => new Date().toISOString()`). Adds `date-fns` as a dependency.
- 123ad2f: Rich text can link to other entries. `tools.reference({ name, label, icon, collection })` picks a published entry and inserts `{ type: name, attrs: { collection, slug } }`; `referenceNode({ name })` is a ready-made node for it, shown in the editor as a card with the entry's title. `collectReferences(doc)` lists the entries a document links to (`{ collection, slugs }[]`), for loading them before rendering. Node forms (`tools.node`) also accept `reference` fields. Adds an admin-only `references` API route that the pickers use.
- 7f29722: Fields can have a `default`: a value, or a function that returns one, type-checked against the field (a `select` default must be one of its options). New entries, never-saved singletons, new array items and new blocks start with their fields' defaults; reading existing entries never applies them. A function default runs when the entry form opens. New `initialValues(fields)` returns the values something starts with.
- a693bc4: Image focal point: image values can store an optional `focalX` / `focalY` (0–1, both or neither), set in the admin by clicking a larger preview or with the arrow keys, with a Reset button. Uploading a new image clears it. `focalPosition(image)` returns the CSS `object-position` for it (`"50% 50%"` without one). Existing images read unchanged.
- 3fd1acd: `array` and `blocks` take `min` and `max`, like `references`; `required` means at least one item. Saving outside the limits fails with an error on the field ("Add at least 1 item"), autosave pauses with the same reason, and the admin disables Add at `max` and says why. The `reference` and `references` pickers are now a search box (combobox) that filters published entries by title or slug, with keyboard and mouse picking; a single `reference` shows the picked entry with a clear button.
- c92fea9: Editor tools can ask for values in a form. `tools.node({ name, label, icon, group, fields, preview })` adds a button that opens a form in the admin's dialog (built from mnml fields and validated like an entry), then inserts the node; in the editor the node shows as a card that double-click edits. `nodeAttributes(fields)` gives the node's extension one attribute per field. A tool's `run` now also gets `{ form, confirm, alert }` as its second argument; existing `run(editor)` tools keep working.
- fb51e7d: New `fields.references(label, collection, { min, max })`: an ordered list of entry slugs, with a picker in the admin to add, reorder and remove entries (Add is disabled at `max`). Validation drops blanks and repeats and checks `min` / `max`; `required` means at least one. New `cms.getEntries(collection, slugs)` reads several published entries in one query, in the order given. Custom `EntryStorage` adapters can add an optional `readRowsBySlug(collection, slugs)`; without it, `getEntries` falls back to `readRows`.
- cd20a9a: New `mediaImporter(storage)` and `importRemoteMedia(url, storage)` in `@n3wtou/mnml-cms/sync`: copy images from another site (e.g. `cdn.sanity.io`) into the site's media storage for migration scripts, returning the URL for an `image` field. Idempotent: each source URL is stored once and found again on later runs through the storage's `list()`. Only https JPEG/PNG/WebP/GIF/AVIF images up to 4 MB by default (`maxBytes`).
- 2000666: `<RichText>` can render nodes with your own React components. Map node names to components in `defineEditor({ components })` (used by every `<RichText editor={editor}>`) or pass `components` to one `<RichText>`, which wins for the same node. Each component gets the node as Tiptap JSON, its `attrs` and its rendered `children`. Nodes without a component render through `renderHTML` as before. New types: `RichTextComponents` and `RichTextNodeProps` from `@n3wtou/mnml-cms/editor`.
- 00fdcc2: Tables in rich text: `import { tables } from '@n3wtou/mnml-cms/table'` and spread `tables.extensions` and `tables.tools` into `defineEditor`. Adds an "Insert table" button, and a small toolbar above the table (while the cursor is in it) for rows, columns, the header row and deleting the table. `<RichText>` renders a plain `<table>`; the admin has table styles. A separate entry point, so sites without tables don't load the table code. Tools can now take `visible(editor)` to show only sometimes, and `context: '<node>'` to show in a small toolbar above that node instead of the main toolbar. In each toolbar group, the package's ready-made tools now come before the site's own.
- 820c741: Select options can have labels: `fields.select('Category', ['news', { value: 'guide', label: 'How-to guide' }] as const)`. The admin shows the labels, entries store the values, and the value type is still inferred. New `selectLabel(field, value)` gives the label for showing a value on the site. A stored value that is no longer an option shows as "(unavailable)" in the admin.

### Upgrade notes

No breaking changes and no database change; stored content reads as before. Two behaviour changes to know about:

- `required: true` on an `array` or `blocks` field now means at least one item. Entries where such a list is empty won't save (or autosave) until an item is added.
- In each editor toolbar group, the package's ready-made tools now come before the site's own.

## 1.3.0

### Minor Changes

- 72e6103: Move content between databases (dev to prod and back). New entry `@n3wtou/mnml-cms/sync` with `exportContent`, `planImport`, `applyImport`, `describePlan` and `missingMedia`, which work on any `EntryStorage` and need no Next.js, so they run from a plain script. The example has `pnpm db:export`, `db:import` and `db:sync`.

  - Modes: `add` (only what the target lacks), `overwrite`, `replace` (make the target match, deleting the rest).
  - `--from-env-file`, `--to-env-file` and `--env-file` read the database URL from an env file (e.g. `.env.production`) instead of a variable, so dev and prod can each have their own `DATABASE_URL`.
  - Dry run unless `--apply`; a non-local database also needs `--yes`; the target is backed up to `.mnml-backups/` first; entries are validated against the config and nothing is written if any don't fit.
  - Moves the config's collections and their autosaved drafts. Not sign-in state, preview copies or uploaded files: files the content uses that the target doesn't have are listed.

## 1.2.0

### Minor Changes

- f4893be: Drafts autosave, like Sanity. Edits to an existing collection entry are saved as its draft about 1.5 seconds after you stop typing, and the live version only changes on **Publish**. The "Save draft" button is gone; **Discard changes** (in the "⋮" menu) goes back to the live version. A new entry is stored with **Create draft** (or published straight away) and autosaves from then on.

  - Autosave only stores valid data: while a field is invalid or a required one is empty, the header says what is wrong and nothing is saved (leaving the page warns first). Publish never fails on a stored draft.
  - If the entry was changed somewhere else since the form opened, autosave stops and asks for a reload instead of overwriting.
  - Live preview follows autosave and no longer writes its own copy of every change.
  - New `drafts: true` option on `singleton()` gives a singleton the same autosave, Publish and Discard changes. Off by default: a singleton's Save still publishes straight away.
  - No database change. Existing saved-but-unpublished changes are the draft.
  - The preview banner now reads "unpublished changes are shown".

- 2963a93: `blocks` fields add a section from one "Add section" button that opens a picker, instead of a row of buttons that grows with every block. The picker has a search box once there are more than eight blocks and works with the keyboard. `block(label, fields, { description })` adds a one-line hint under each block's name, and `fields.blocks(label, blocks, { addLabel })` renames the button.

### Patch Changes

- ec555b3: The sign-in form no longer puts the password in the URL when it is submitted before the page's JavaScript is ready (or without JavaScript): it now posts to the login route, which signs in and redirects, or redirects back to the login page with an error. Signing in with JavaScript is unchanged.

## 1.1.0

### Minor Changes

- 8544bca: New `blocks` field for pages built from different kinds of sections: `fields.blocks('Sections', { hero: block('Hero', { … }), … })`. Each section is one of the blocks, with its own fields in the admin and a `kind` to narrow on when rendering. Stored items are `{ kind, …fields }`; items whose kind is not in the config are dropped on read.
- 8544bca: Conditional fields: `showIf` on any field shows it only while its sibling fields match, e.g. `fields.url('URL', { showIf: { type: 'link' } })`. Hidden fields are not validated and keep their stored value. A `showIf` that names a field that is not a sibling throws when the config loads.

## 1.0.0

### Major Changes

- 809ddb3: Everything named `cms-*` is now `mnml-*`.

  - CSS variables `--cms-*` → `--mnml-*` (e.g. `--mnml-primary`, `--mnml-font-brand`), classes `cms-prose` / `cms-root` / `cms-state` → `mnml-*`, and the Tailwind tokens `bg-cms-*` / `text-cms-*` / `font-cms-brand` → `bg-mnml-*` / `text-mnml-*` / `font-mnml-brand`. Rename any overrides in your CSS.
  - The default `apiPath` is `/api/mnml` (was `/api/cms`): move `app/api/cms/[...route]/route.ts` to `app/api/mnml/[...route]/route.ts`. Images saved before are stored as `/api/cms/media/…` URLs, so existing sites should keep `apiPath: '/api/cms'` (or rewrite those URLs in the entries) — otherwise those images 404 and the Media screen lists them as unused.
  - `localMedia()` stores files in `.mnml-uploads` (was `.cms-uploads`): rename the folder and its `.gitignore` entry.
  - Cookies are `mnml_session` and `mnml_preview`, so editors sign in again once after upgrading.
  - Docs and the example use `mnml.config.ts`, `src/mnml.ts` and `src/mnml-editor.ts` (file names are your choice; nothing in the package depends on them).

### Minor Changes

- 809ddb3: Extend the rich-text editor with your own Tiptap extensions and toolbar buttons.

  - New entry `@n3wtou/mnml-cms/editor` with `defineEditor({ extensions, tools })` and ready-made `tools.underline`, `tools.strike` and `tools.horizontalRule`. `extensions` is added to the defaults, or a function that gets the defaults and returns the full list.
  - `editorProvider(config)` from `@n3wtou/mnml-cms/admin` makes the client component to pass as the new `editor` option of `createCms`.
  - `<RichText>` takes an `editor` prop so the site renders with the same extensions.
  - The toolbar is grouped (history, text style, formatting, blocks, inserts; tools take an optional `group`), and its heading and quote buttons are now one text-style menu (Paragraph, Heading 1–4, Quote). Headings now go from level 1 to 4 (was 2 and 3); add styles for `h1` and `h4` to your site's rich-text CSS.

## 0.2.0

### Minor Changes

- 7a4a45a: New fields, a publish workflow, and sorted reads.

  - New fields: `select`, `boolean`, `number`, `reference`, `group`, and `seo()` (a ready-made group, with `seoMetadata()` to turn it into Next.js `Metadata`).
  - `derived` values on singletons and collections (computed on read, typed, usable in `orderBy`/`filter`, shown read-only in the admin form; place them with `derive(fn, { after, label })`), plus `plainText()` and `readingTime()` helpers.
  - `listEntries(key, { orderBy, order, filter, limit, offset })`.
  - Draft/published status for collection entries, with "Save draft", "Publish" and "Unpublish" in the admin, a status dot, and pending changes on published entries (saved as a draft without touching the live version).
  - Tabs in the admin form for entries with `group` fields (All fields, General, one per group).
  - `storage` option: pass your own `EntryStorage` (five plain queries) to use Prisma, Kysely or plain SQL instead of Drizzle. `drizzleStorage()` is the built-in adapter.
  - Media screen in the admin: lists stored files, where each is used, and deletes them. `MediaStorage` gains optional `list()` and `delete()` (implemented by `vercelBlobMedia` and `localMedia`).
  - A built-in confirm/alert dialog (`useAdmin().confirm()` / `.alert()`) replaces the browser's `confirm()` and `alert()` for deleting entries and media.
  - Authentication: `auth` also accepts an `AuthAdapter` (`isAdmin`, a `login` component shown in the admin's login card or a `loginUrl`, `signOut`) to use your own login. The built-in login now locks an IP out for 15 minutes after 5 failed attempts, ties sessions to the password and a "Sign out everywhere" counter, and renews a 24-hour session while the editor is active.
  - Image alt text, for `image` fields and for images in rich text.

  Breaking:

  - **Sessions are 24 hours (renewed while active), and the cookie format changed.** Everyone signs in once after upgrading.
  - **New `status` column.** Run `drizzle-kit push` once before upgrading. Existing rows stay published.
  - **Public readers hide drafts.** `listEntries`, `getEntry` and `listSlugs` only return published entries (the editor's live preview still shows the draft). `listEntries` now also returns `status` per item.
  - **`image` fields are `{ url, alt } | null`** instead of a string. Strings already stored are still read (as `alt: ''`), so no data migration is needed, but code that uses the value as a URL must read `.url`.

## 0.1.0

- Initial release: extracted from a portfolio site into a standalone package.
