---
title: "Upgrading"
description: "What each mnml-cms version added, what broke, and the steps to upgrade an older site."
url: https://mnml-cms.vercel.app/upgrading
---

# Upgrading

Check the installed version first:

```sh
grep '"version"' node_modules/@n3wtou/mnml-cms/package.json
```

Upgrade one major at a time. Run the type check after each, and click through `/admin` before moving on. The [changelog](https://github.com/mbuguanewton/mnml-cms/blob/main/packages/cms/CHANGELOG.md) has every release.

## Versions

| Version | Adds | Breaking |
| --- | --- | --- |
| 0.1.0 | Initial release: singletons and collections; `text`, `textarea`, `date`, `url`, `image` (a string), `richtext`, `tags`, `array`; password login; Postgres JSON table. | |
| 0.2.0 | `select`, `boolean`, `number`, `reference`, `group`, `seo()` and `seoMetadata()`; `derived` values (`derive`, `plainText`, `readingTime`); `listEntries(key, { orderBy, order, filter, limit, offset })`; draft/published status for collections; `storage` option (own `EntryStorage`, e.g. Prisma); Media screen; `AuthAdapter`; login lockout; image alt text. | New `status` column (run `drizzle-kit push`). Public readers hide drafts, and `listEntries` returns `status`. `image` is `{ url, alt } \| null` (stored strings still read). Sessions are 24 hours and the cookie format changed. |
| 1.0.0 | `@n3wtou/mnml-cms/editor` (`defineEditor`, extra Tiptap extensions and toolbar tools), `editorProvider`, `<RichText editor>`; grouped toolbar; headings 1–4. | Everything `cms-*` became `mnml-*`: CSS variables (`--mnml-*`), classes, Tailwind tokens; default `apiPath` is `/api/mnml` (was `/api/cms`); upload folder `.mnml-uploads`; cookies `mnml_session` and `mnml_preview`. |
| 1.1.0 | `fields.blocks()` and `block()`; `showIf` on any field. | |
| 1.2.0 | Autosave drafts, Discard changes, `drafts: true` on singletons; block picker (`description`, `addLabel`); sign-in form no longer puts the password in the URL. | No "Save draft" button. Behaviour change only; no API or database change. |
| 1.3.0 | `@n3wtou/mnml-cms/sync`: content export and import between databases. | |
| 1.4.0 | `fields.references()` + `cms.getEntries()`; `fields.datetime()`; `default` on fields + `initialValues()`; select option labels + `selectLabel()`; `min` / `max` on `array` / `blocks` / `references`; combobox entry pickers; `<RichText components>` and `defineEditor({ components })`; `tools.node()` + `nodeAttributes()`; `tools.reference()`, `referenceNode()`, `collectReferences()`; tool `visible` / `context`; `@n3wtou/mnml-cms/table` (`tables`); `mediaImporter()` / `importRemoteMedia()` in `/sync`; image focal point (`focalX` / `focalY`) + `focalPosition()`. | No API or database change. `required` on `array` / `blocks` now means at least one item; the package's toolbar tools come before the site's own in each group. |
| 1.4.1 | Docs moved to https://mnml-cms.vercel.app; the README covers install and setup only. | No code change. |
| 1.5.0 | MCP server for agents (`mcp` option, scoped tokens, approval of deletes and discards, Markdown rich text); `listEntries` returns `createdAt` / `updatedAt`; `change.by`; `markdownToRichText()` / `richTextToMarkdown()` in `/sync`; MCP `docs` tool, docs pages as `.md`, `AGENTS.md` in the package. | No API or database change. |
| 1.6.0 | Agent tokens from the admin (`mcp.adminTokens`); own admin controls (`Select`, `Checkbox`, `Switch`, `Tooltip`, toasts, `Menu`); `ui` option + `uiProvider()` to use your own components (e.g. shadcn) with a token bridge, `useAdminPortal()`, `mnml-admin` class; own date picker (`DatePicker`, time inside the calendar); rich text toolbar overflow menu, fullscreen editor, resizable inline editor; collection list paging and search. | The Drizzle schema file moved: `drizzle.config.ts` must use `schema: './node_modules/@n3wtou/mnml-cms/dist/server/content/db.js'` (was `dist/server/db.js`). No database change. Native selects, checkboxes, date and time popups are replaced by the admin's own, so CSS targeting those native elements in the admin may need a look. |
| 1.7.0 | Collection list filters (`filters`) and sortable columns (`columns`), a Columns menu for editors (`columnChoices`); row selection with bulk Publish, Unpublish, Delete and your own actions (`listActions`); "Choose from uploads" picker and multiselect delete on the Media page; "Create new" for `reference` and `references` fields (side panel, `createNew: false` to turn off); new `image` field design (drop zone, toolbar over the preview, focal point in place); `brand: { name, logo }`; Revoke on config tokens in Agent access. | No API or database change. Editors' column choices are saved in a `mnml_cols_<collection>` cookie. The collection list now uses the full page width. The Drizzle schema path is `dist/server/content/db.js` (since 1.6.0). |
| 1.8.0 | Drag to reorder rows in `array`, `blocks` and `references` fields (a grip replaces the up and down arrows; keyboard: ↑ ↓ Home End); new `cache` option to keep published reads between requests (`cache: true`, expired by each save or delete). | No API or database change. `cache` is off by default: turn it on with `createCms(config, { cache: true })`. Content written outside the CMS (`db:import`, `sync`, SQL) shows up after the cache's `revalidate` time (default 3600 seconds). |
| 1.9.0 | Changing a field while entries hold content: the admin shows the old value beside the new field (**Use this**, **Remove**) and waits before saving ([Changing fields](https://mnml-cms.vercel.app/changing-fields.md)); entries that crashed the admin (`date`, `references`, `image` holding the wrong kind of value) open; the "Add section" list and the entry picker no longer push the page. | No API or database change. **Readers now return the field's empty value for a stored value that doesn't fit its field**, instead of passing it through; `next dev` logs a warning for each. Valid entries read as before. If your site relied on a wrongly typed stored value, fix the entry in the admin. |
| 1.10.0 | Search for RAG and agents (`search` option, `cms.search()`, a `search_content` tool, over an index you plug in: [Search](https://mnml-cms.vercel.app/search.md)); the admin assistant, a chat panel that answers from your content and fills fields for review (`ai: assistant({ model })` from `@n3wtou/mnml-cms/ai`, Gateway or any AI SDK model, your own tools, `cms.tools()`: [Assistant](https://mnml-cms.vercel.app/assistant.md)); Activity on each entry and singleton, with the `actor` option ([Activity](https://mnml-cms.vercel.app/activity.md)). | No breaking changes, and no database change: activity is stored in the entries table under `activity:<key>`. Search, the assistant and `actor` are off or unnamed until you set them. To use the assistant, `npm i ai` (an optional peer dependency; sites without it never load it). |

## Upgrade steps

**0.1.x → 0.2.0**
1. Add the `status` column before deploying: `drizzle-kit push` against each database. Existing rows stay published.
2. Search the code for `image` fields used as a URL string and change them to `.url` (add `alt={…alt}`).
3. Draft entries now 404 publicly. That's expected.
4. Everyone signs in once.

**0.2.x → 1.0.0**
1. Rename CSS variables, classes and Tailwind tokens (`--cms-*`, `cms-prose`, `cms-root`, `cms-state`,
   `bg-cms-*`, `text-cms-*`, `font-cms-brand`) to `mnml-*`.
2. Either move `app/api/cms/[...route]/route.ts` to `app/api/mnml/[...route]/route.ts`, or keep
   `apiPath: '/api/cms'` in `createCms` (required if images were uploaded before, since their URLs contain `/api/cms/media/`).
3. Rename `.cms-uploads` to `.mnml-uploads` (and its `.gitignore` line).
4. Headings in rich text now go 1–4: add styles for `h1` and `h4`.
5. Editors sign in again.

**1.5.x → 1.6.0**
1. In `drizzle.config.ts`, change `schema` to `'./node_modules/@n3wtou/mnml-cms/dist/server/content/db.js'`. The old `dist/server/db.js` is gone, so `drizzle-kit push` fails until you do. The `@n3wtou/mnml-cms/db` and `/schema` imports are unchanged.
2. If your admin CSS targets native selects, checkboxes or date and time inputs, check `/admin`.

**1.0 → 1.x:** no breaking changes. 1.2.0 changes how editors save drafts, which is worth telling them. 1.4.0: check `required: true` on `array` / `blocks` fields, since entries with an empty list won't save until an item is added.

## What a project has

```sh
grep -n "blocks:\|showIf\|select:\|number:" node_modules/@n3wtou/mnml-cms/dist/define.d.ts node_modules/@n3wtou/mnml-cms/dist/schema/define.d.ts 2>/dev/null
ls node_modules/@n3wtou/mnml-cms/dist/sync.js node_modules/@n3wtou/mnml-cms/dist/sync/index.js 2>/dev/null  # 1.3.0+
ls node_modules/@n3wtou/mnml-cms/dist/table-entry.js node_modules/@n3wtou/mnml-cms/dist/editor/tables.js 2>/dev/null  # 1.4.0+
grep -rn "apiPath" src app 2>/dev/null | head                  # a kept '/api/cms'?
```
