---
'@n3wtou/mnml-cms': minor
---

MCP: rich text as Markdown. Agents can send a Markdown string for any `richtext` field (nested ones too), and the server converts it to Tiptap JSON. Headings, bold, italic, strike, code, links, lists, quotes, code blocks, images and horizontal rules convert. Tables and raw HTML are refused with a field error; send Tiptap JSON for those. `get_entry` and `list_entries` take `richText: 'markdown'` to return rich text as Markdown. Nodes Markdown can't express come out as `<!-- mnml:<type> -->`, with `lossy: true`.

`markdownToRichText` and `richTextToMarkdown` are exported from `@n3wtou/mnml-cms/sync` for import scripts.

Fix: MCP `publish` and `unpublish` no longer fail on entries saved before a field was added.

New dependency: `@tiptap/markdown`. Not breaking.
