# @n3wtou/mnml-cms for agents

A schema-driven CMS embedded in a Next.js site. `mnml.config.ts` defines the content. Entries are JSON rows in one Postgres table.

## Where to look

- **Types:** `dist/schema/define.d.ts` (fields, config), `dist/server/index.d.ts` (`createCms`, readers). They match this installed version.
- **Docs as Markdown:** every page at its URL plus `.md`, e.g. https://mnml-cms.vercel.app/fields/blocks.md. Index: https://mnml-cms.vercel.app/llms.txt
- **MCP:** if the site runs the MCP server, its `docs` tool returns the right `.md` links for a topic.
- The docs site shows the latest version. If something isn't in the installed types, the project's version doesn't have it: see https://mnml-cms.vercel.app/upgrading.md

## Rules agents break most

- `@n3wtou/mnml-cms/next` is server-only. Scripts use `/db` and `/sync`.
- `mnml.config.ts` is plain data. Safe to import anywhere.
- An `image` is `{ url, alt } | null`. Never a string. Never hand-write media URLs.
- Public readers return published entries only. A draft is a 404.
- `kind` is reserved inside blocks.
- Changing fields needs no migration. Run the type check after.
