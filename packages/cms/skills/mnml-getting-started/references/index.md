<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# mnml-cms

A small CMS that lives inside your Next.js site.

- **One config file** defines your content.
- **The admin** is a route in your app (`/admin`).
- **Entries** live in your Postgres, one JSON table. No migrations when the model changes.

- **AI agents** edit content through the built-in MCP server. Drafts only; an editor approves deletes. ([Agents](https://mnml-cms.vercel.app/agents))
- **Skills ship in the package**, so Claude Code knows the version you installed. ([Help your AI agent](https://mnml-cms.vercel.app/getting-started#help-your-ai-agent))

Needs Next 16+ (App Router), React 19+ and Tailwind v4.

Start: [Getting started](https://mnml-cms.vercel.app/getting-started). Full app: [`example/`](https://github.com/mbuguanewton/mnml-cms/tree/main/example).
