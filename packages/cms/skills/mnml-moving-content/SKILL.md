---
name: mnml-moving-content
description: "Moving mnml content: export/import between databases, migrating from another CMS, rehosting images, Markdown to rich text in scripts."
---

<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

> Matches the installed version. Online: https://mnml-cms.vercel.app/moving-content

# Moving content between databases

Seed prod from dev, or pull prod back into dev. `@n3wtou/mnml-cms/sync` exports content to JSON, compares a file with a database, and writes the difference. It runs in a plain script, no Next.js.

The example's `scripts/content.ts`:

| Command | Does |
| --- | --- |
| `pnpm db:export` | `DATABASE_URL` to `mnml-content.json` |
| `pnpm db:import mnml-content.json --mode add` | Dry run: file into `DATABASE_URL` |
| `pnpm db:sync --from DATABASE_URL --to PROD_DATABASE_URL --mode add --apply --yes` | One database into another |
| `pnpm db:sync --from-env-file .env.local --to-env-file .env.production --mode add --apply --yes` | Same, URLs read from files |

## Choosing the databases

- `--env`, `--from`, `--to`: name an env var holding a database URL. URLs stay out of shell history.
- `--env-file`, `--from-env-file`, `--to-env-file`: read the var from a file. Default var `DATABASE_URL`. The file is only read, never loaded into the env.
- A `BLOB_READ_WRITE_TOKEN` in the target's file powers the missing-image check.

## Modes

| `--mode` | Does |
| --- | --- |
| `add` | Adds missing entries. Leaves existing ones. |
| `overwrite` | Also replaces entries that differ. |
| `replace` | Target matches the file. Deletes entries not in it. |

## Safety

- Dry run until `--apply`.
- A database not on localhost also needs `--yes`.
- Target content is backed up to `.mnml-backups/` first. Undo: `db:import <backup> --mode replace`.
- Entries are checked against your config. Any misfit: nothing is written.
- Source and target can't be the same.
- Running twice is safe.
- Not atomic (Neon HTTP has no transactions). Stopped halfway? Run again.

## What moves

| Moves | Doesn't |
| --- | --- |
| Collections and singletons in the config | Sign-in state |
| Their autosaved drafts | Preview copies |
| | **Uploaded images** |

- The script lists images the target's storage lacks. Copy those files yourself.
- `createdAt` / `updatedAt` are set when written.

## In your own scripts

Exported: `exportContent`, `planImport`, `applyImport`, `describePlan`, `missingMedia`. Connect with `drizzleStorage` or `neonDatabase`.

## Markdown content

`markdownToRichText` turns Markdown (a blog export, another CMS) into Tiptap JSON for a `richtext` field.

```ts
import { markdownToRichText, richTextToMarkdown } from '@n3wtou/mnml-cms/sync';

const content = markdownToRichText(post.body); // throws on tables and raw HTML
const { markdown, lossy } = richTextToMarkdown(entry.content); // lossy: some nodes became <!-- mnml:<type> -->
```

## Rehosting images

Images from another CMS live on its CDN (e.g. `cdn.sanity.io`). `mediaImporter` copies them into this site's storage and returns the URL for an `image` field.

```ts
import { mediaImporter, vercelBlobMedia } from '@n3wtou/mnml-cms/sync';

const importImage = mediaImporter(vercelBlobMedia()); // pass `apiPath` if it isn't /api/mnml
const { url } = await importImage('https://cdn.sanity.io/images/…/photo.jpg');
await storage.upsert('posts', slug, { …post, cover: { url, alt } }, 'published');
```

- Use the site's storage.
- Each source URL is stored once (file named after its hash). Later runs find it via `list()` and skip the download. Both built-in storages have `list()`; without it, repeats are only skipped within one importer.
- Accepts `https://` JPEG, PNG, WebP, GIF, AVIF up to 4 MB (`maxBytes` to raise). Else throws with the reason.
- `importRemoteMedia(url, storage)`: one image. Use one `mediaImporter` per run.
- Example script: `pnpm media:import <url…>`.
