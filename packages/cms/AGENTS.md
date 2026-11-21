# @n3wtou/mnml-cms for agents

A schema-driven CMS embedded in a Next.js site. `mnml.config.ts` defines the content. Entries are JSON rows in one Postgres table.

## Read first

- **Skills:** `skills/mnml-*/SKILL.md` in this package. One per topic: getting started, fields, reading content, drafts, moving content, editor, agents (MCP), setup, upgrading. They match this installed version.
- **Types:** `dist/define.d.ts` (fields and config), `dist/server/index.d.ts` (`createCms`, readers).
- **Docs site:** https://mnml-cms.vercel.app (latest version). Index for agents: https://mnml-cms.vercel.app/llms.txt

## Rules agents break most

- `@n3wtou/mnml-cms/next` is server-only. Scripts use `/db` and `/sync`.
- `mnml.config.ts` is plain data. Safe to import anywhere.
- An `image` is `{ url, alt } | null`. Never a string. Never hand-write media URLs.
- Public readers return published entries only. A draft is a 404.
- `kind` is reserved inside blocks.
- Changing fields needs no migration. Run the type check after.

## Use the skills in Claude Code

Claude Code loads skills from `.claude/skills/`. Link them once:

```sh
mkdir -p .claude/skills && for s in node_modules/@n3wtou/mnml-cms/skills/*; do ln -sfn "../../$s" ".claude/skills/$(basename "$s")"; done
```

Links follow package upgrades. Other agents: read `skills/mnml-*/SKILL.md` directly.
