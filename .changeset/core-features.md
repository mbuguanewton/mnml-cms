---
'@n3wtou/mnml-cms': minor
---

New fields, a publish workflow, and sorted reads.

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
