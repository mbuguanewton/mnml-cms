---
'@n3wtou/mnml-cms': minor
---

An assistant in the admin: a chat panel that knows the open page, answers questions from your content and fills fields for the editor to review. Off by default; nothing changes for sites that don't turn it on.

- `ai: assistant({ model })` in `createCms()`, with `assistant` from `@n3wtou/mnml-cms/ai`, adds a button at the bottom right of every admin screen that opens the panel. It runs on the Vercel AI SDK: install `ai` (an optional peer dependency; sites that don't use the assistant never load it). `model` is an AI Gateway id such as `'anthropic/claude-sonnet-5-5'` (set `AI_GATEWAY_API_KEY`; automatic on Vercel), or any AI SDK model such as `google('gemini-2.5-flash')`. The package has no provider code.
- `assistant({ name, tone })`: `name` (default 'Assistant') renames the button and panel and what the model calls itself; `tone` is a sentence about how it should write.
- `assistant({ tools })`: your own tools, made with `tool()` from `ai`, as an object or a function of the open page. They run on your server for signed-in editors and can do what your code does, so keep them to reading. Names of the built-in tools are reserved.
- `cms.tools()` returns the CMS's read tools (search, list entries, get an entry, get the schema) in the AI SDK's format for your own agent or RAG code: `streamText({ model, tools: cms.tools() })`. `cms.tools({ collections: ['posts'] })` limits what they see. They cannot write.
- On an entry the assistant sees the fields and the form's current values. It can ask for a summary, a new title, or to fill empty fields. Values land in the form as unsaved edits with an Undo button; each field is checked like a save first, and rich text can be Markdown. The assistant cannot save, publish or delete.
- Earlier chats: a History button lists the chats of the page the editor has open and reopens one; New chat keeps the old one. They are kept in the browser (`localStorage`), per page, the last 12, words only (never the form's values).
- Replies are shown as Markdown by a small built-in renderer (no new dependency, no raw HTML). It is a `Markdown` slot of the `ui` option, so a site can swap in its own renderer; `Markdown` is exported from `@n3wtou/mnml-cms/admin` too.
- It answers questions about the site with the same read tools as the MCP server, and `search_content` when `search` is on.
- `POST <apiPath>/ai/chat` streams the answer. Signed-in editors only, 20 questions a minute for each client, capped request size.
