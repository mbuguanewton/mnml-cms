# Changelog

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
