---
'@n3wtou/mnml-cms': minor
---

Agent docs in the package, built from the docs site so they match the installed version.

- `skills/mnml-*`: Claude Code skills, one per docs section (getting started, fields, reading content, drafts, moving content, editor, agents, setup, upgrading). `AGENTS.md` shows how to link them into `.claude/skills/`.
- `AGENTS.md`: where the skills, types and docs are, and the rules agents break most.
- MCP: a `docs` tool (scope `read`) returns links to the right docs pages for a topic.
- The docs site serves `/llms.txt` and `/llms-full.txt`, and has new "Common mistakes" and "Upgrading" pages.
