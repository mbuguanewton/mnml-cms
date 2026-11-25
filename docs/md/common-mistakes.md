---
title: "Common mistakes"
description: "The mistakes that cost the most time with mnml-cms, and how to avoid them."
url: https://mnml-cms.vercel.app/common-mistakes
---

# Common mistakes

## Imports

- `@n3wtou/mnml-cms/next` is server-only. It fails in plain scripts (`tsx`). Scripts use `@n3wtou/mnml-cms/db` for the table and `@n3wtou/mnml-cms/sync` for content.
- `mnml.config.ts` is plain data. Import it anywhere, client components too.

## Values

- An `image` is `{ url, alt } | null`, not a string. Use `.url`, and pass `alt` to the `<img>`.
- Never write media URLs by hand. Upload, or use `mediaImporter` ([Moving content](https://mnml-cms.vercel.app/moving-content.md)).
- Blank inputs are stored as `null` for `date`, `url`, `number`, `select` and `reference`. `boolean` ignores `required`.
- A `reference` stores a slug only. Read it with `getEntry`. Nothing checks that the entry still exists.

- Changing a field's type while entries hold content is safe: the admin shows the old value and asks. See [Changing fields](https://mnml-cms.vercel.app/changing-fields.md).

## Blocks and conditional fields

- `kind` is reserved in blocks. A block can't have a field named `kind`.
- A block removed from the config is dropped from entries on read.
- `showIf` hides a field, it doesn't delete it. Hidden fields keep their value and skip validation. Readers still return it, so check the same condition on the page.

## Drafts

- Public readers return published entries only. A draft is a 404 on the site.
- Edits to an existing entry autosave as a draft. They go live on Publish only.
- A singleton publishes on Save, unless it has `drafts: true`.
- Render `<cms.PreviewBanner />` in the site layout, or editors can't leave preview.

## Routes and layout

- `apiPath` is `/api/mnml`. Sites upgraded from before 1.0.0 with uploaded images keep `apiPath: '/api/cms'`, or those images 404.
- Next.js 16 names the middleware file `proxy.ts`.
- Keep the admin out of the site's header and footer: put them in a route group layout, e.g. `app/(site)/layout.tsx`.

## After upgrading the package

Restart the dev server (`rm -rf .next`) and your editor's TypeScript server. Stale types and hot-reload state look like real errors.
