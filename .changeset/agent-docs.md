---
'@n3wtou/mnml-cms': minor
---

Docs for agents, all generated from the docs site's pages.

- Every docs page is served as Markdown at its URL plus `.md` (e.g. `/fields/blocks.md`), with `title`, `description` and `url` in its frontmatter. `/llms.txt` and `/llms-full.txt` list and bundle them.
- MCP: a `docs` tool (scope `read`) returns the `.md` links of the pages matching a topic.
- `AGENTS.md` in the package: where the types and docs are, and the rules agents break most.
- New docs pages: "Common mistakes" and "Upgrading".
