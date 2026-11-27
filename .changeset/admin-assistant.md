---
'@n3wtou/mnml-cms': minor
---

An assistant in the admin: a chat panel that knows the open page, answers questions from your content and fills fields for the editor to review. Off by default; nothing changes for sites that don't turn it on.

- `ai: { model }` in `createCms()` adds a button at the bottom right of every admin screen that opens the panel. The model is yours, like image storage and search: `model` is an adapter with one `stream()` method over a provider's API. The package has no provider code and no new dependency. `example/src/mnml/ai.ts` and the docs have adapters for Claude, OpenAI and Gemini. Types: `AiModel`, `AiMessage`, `AiTool`, `AiEvent`. `name` (default 'Assistant') renames the button and panel and what the model calls itself; `tone` is a sentence about how it should write.
- On an entry the assistant sees the fields and the form's current values. It can ask for a summary, a new title, or to fill empty fields. Values land in the form as unsaved edits with an Undo button; each field is checked like a save first, and rich text can be Markdown. The assistant cannot save, publish or delete.
- Replies are shown as Markdown by a small built-in renderer (no new dependency, no raw HTML). It is a `Markdown` slot of the `ui` option, so a site can swap in its own renderer; `Markdown` is exported from `@n3wtou/mnml-cms/admin` too.
- It answers questions about the site with the same read tools as the MCP server, and `search_content` when `search` is on.
- `POST <apiPath>/ai/chat` streams the answer. Signed-in editors only, 20 questions a minute for each client, capped request size.
