---
title: "Assistant"
description: "The admin assistant: a chat panel that knows the open page, answers questions from your content and fills fields for the editor to review. Set up with one line through the Vercel AI Gateway or any AI SDK model, with your own tools."
url: https://mnml-cms.vercel.app/assistant
---

# Assistant

A chat panel in the admin. A button at the bottom right opens it. Off by default.

The assistant knows the page the editor has open: the fields and their current values. Editors can:

- **Ask about the content.** "Which posts mention refunds?" It searches the published content and answers from it.
- **Ask it to write.** "Write a summary", "Suggest a better title", "Fill in the empty fields". What it writes goes into the form as an **unsaved edit**. The editor reads it, changes it or presses **Undo**, then saves or publishes as usual.

The assistant can read content. It cannot save, publish, unpublish or delete anything. Only the editor does that.

## Turn it on

Install the [AI SDK](https://ai-sdk.dev) (`ai`). The package has no provider code of its own, and sites that don't use the assistant never load it.

```sh
npm i ai
```

Then pass an assistant to `createCms`. The easiest model is an [AI Gateway](https://vercel.com/ai-gateway) id: no provider package, one key.

```ts filename="src/mnml/index.ts"
import { assistant } from '@n3wtou/mnml-cms/ai';

export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL),
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  ai: assistant({ model: 'anthropic/claude-sonnet-5-5' }),
});
```

Set `AI_GATEWAY_API_KEY` in `.env.local`. On Vercel no key is needed: it signs in by itself. Model ids are `provider/model`, as listed in the [Gateway's model list](https://vercel.com/ai-gateway/models). The Gateway also gives you fallbacks, spend budgets and logs, so you don't build those.

The key stays on the server. The browser only talks to `<apiPath>/ai/chat`.

For answers about the whole site, turn on [search](https://mnml-cms.vercel.app/search.md) too. Without it, the assistant can still list and read entries and search by keyword, but not by meaning.

Replies are shown as Markdown by a small built-in renderer. To use your own (for tables or code highlighting), give the `Markdown` slot of the [custom admin UI](https://mnml-cms.vercel.app/custom-admin-ui.md) a component.

## Choosing a model

`model` is a Gateway id string, or any AI SDK model. To go to a provider directly, install its package:

```ts
import { google } from '@ai-sdk/google'; // npm i @ai-sdk/google, key in GOOGLE_GENERATIVE_AI_API_KEY

ai: assistant({ model: google('gemini-2.5-flash') }),
```

`@ai-sdk/anthropic`, `@ai-sdk/openai` and many more work the same way, and so does any OpenAI-compatible endpoint (a local model, for example). See the [AI SDK providers](https://ai-sdk.dev/providers).

## Name and tone

Give it a name and a voice. The name is what the button and the panel are called, and what the model calls itself. The tone is how it answers and how it writes into fields.

```ts
ai: assistant({
  model: 'anthropic/claude-sonnet-5-5',
  name: 'Scribe', // default 'Assistant'
  tone: 'Friendly and concise. Plain words, no jargon.',
}),
```

Write the tone in your own words: "Formal, British spelling", "Short sentences, no exclamation marks". It applies to the answers and to the text the assistant puts in fields.

## Your own tools

Give the assistant tools of your own, made with `tool()` from `ai`: a price from your shop API, stock from your warehouse, a style guide.

```ts
import { tool } from 'ai';
import { z } from 'zod';

ai: assistant({
  model: 'anthropic/claude-sonnet-5-5',
  tools: {
    productPrice: tool({
      description: 'Current price of a product from our shop API',
      inputSchema: z.object({ sku: z.string() }),
      execute: async ({ sku }) => (await fetch(`https://shop.example.com/api/${sku}`)).json(),
    }),
  },
}),
```

The panel shows "Using productPrice…" while a tool runs. A tool that throws doesn't stop the answer: the model is told it failed.

A function gets the open page, so a tool can exist only where it belongs:

```ts
tools: ({ page }) => (page.key === 'posts' ? { productPrice } : {}),
```

`page` is `{ key, slug }` of the entry the editor has open, or empty on other screens. A tool can use your `cms` too (`cms.getEntry`, `cms.search`); write the `execute` return type out when you do, because `cms` is the value being built.

- Your tools run on your server for signed-in editors only, and can do whatever your code does, including writes. Keep them to reading. The assistant's own way to change content is the form, and the editor reviews that.
- A tool can't have the name of a built-in one (`get_schema`, `list_entries`, `get_entry`, `search`, `search_content`, `fill_field`, `fill_entry`).
- A tool can't see or change the form. Only `fill_field` and `fill_entry` do, and what they put in is checked first.

## The CMS's tools in your own code

`cms.tools()` returns read tools in the AI SDK's format, so you can give an agent or a RAG pipeline of your own access to the content:

```ts
import { streamText } from 'ai';

const result = streamText({
  model: 'anthropic/claude-sonnet-5-5',
  tools: { ...cms.tools(), productPrice },
  prompt: 'Which posts talk about refunds?',
});
```

By default they see the **published** content only: search (when [`search`](https://mnml-cms.vercel.app/search.md) is on), the schema, and published list and get. That is safe behind a public chatbot. They cannot write. `cms.tools({ collections: ['posts'] })` limits what they can see.

`cms.tools({ drafts: true })` adds drafts and unpublished edits, which is what the admin's assistant sees. Use it only for signed-in editors, never in a public route.

## Earlier chats

**New chat** starts a fresh conversation. The ones before stay: a **History** button in the panel lists the earlier chats of the page the editor has open, newest first, and opens one to read or carry on in. An entry only sees its own chats, and the dashboard and list screens share one list.

By default the chats are kept in the editor's browser (`localStorage`):

- They are not on your server or in your database, and not shared between editors or devices.
- Each answer is kept as a **turn**: the question, the answer and which fields were filled. The form's values are never stored.
- The last 12 chats of each page are kept, within about 150,000 characters. When there are more, the oldest chat goes, with all its turns.
- **Delete this chat**, in the History menu, removes one yourself.
- A reopened chat's old fills have no **Undo**, because the form has moved on.
- A chat belongs to the page it was had on. When a new entry is saved and gets its address, the panel starts fresh on the new page and the earlier chat stays in History under the old one.
- The chats stay in the browser after the editor signs out. On a shared computer, clear the site's data.

To keep them in your own database, and to keep a record of what the assistant did, give `assistant()` a [`store`](#keeping-a-record).

## Keeping a record

To see what the assistant did over time (what it was asked, which tools it used, what it changed in the forms, what it cost), keep every turn in your own database. You write a small store for your database, like [search](https://mnml-cms.vercel.app/search.md)'s index. The package has no database code.

```ts
ai: assistant({
  model: 'anthropic/claude-sonnet-5-5',
  store: {
    // Append one row per question. Runs after the answer is sent, so it never slows it.
    async record(turn, { request }) {
      await db.insert(assistantTurns).values({ ...turn, by: (await sessionOf(request))?.user.id });
    },
    // Optional: read the History menu from your table instead of the browser.
    async turns(page) {
      return db.select().from(assistantTurns).where(eq(assistantTurns.page, page)).orderBy(desc(assistantTurns.at)).limit(300);
    },
  },
}),
```

A **turn** is one question and its answer:

| Field | |
| --- | --- |
| `chatId`, `page`, `at` | The chat it belongs to, the page (`posts/hello`, `settings/` for a singleton, or `site`), and when the answer finished. |
| `question`, `answer` | What was asked and said. |
| `status` | `done`, `stopped` (the editor stopped it, or it ran out of steps) or `error`. |
| `tools` | Every tool it called, with its input (cut when long): searches, reads, your own tools. |
| `fills` | What it put in the form: `fields`, `before` and `after` values, and `dropped` (what was left out, and why). |
| `model`, `usage`, `durationMs` | The model, tokens used, and how long it took. |

- **Append only.** Never update or delete these rows: it is the record. That is why the History menu has no Delete when it reads from your table.
- **Who asked.** `record` and `turns` get the editor's `Request`. The package doesn't know your login, but your code does: read your session there and fill a `by` column.
- **Failures.** A failed `record` is logged and never shown. A failed `turns` shows an empty list.
- **Privacy.** `before` and `after` can hold your content. They go only to your database. Keep what you need and set a retention for the table.
- **`record` is required, `turns` is optional.** With `record` alone you keep the audit trail and the History menu stays in the browser.
- Use parameterised queries: the `page` comes from the request. The package checks and caps what `turns` returns (300 turns, newest first).

`groupTurns(turns)`, from `@n3wtou/mnml-cms/ai`, puts turns back into chats (newest first, each with its messages), if you want a history page of your own.

### Example: Postgres

`example/src/mnml/postgres-assistant-store.ts` in the repo is a store for Postgres (Neon's `sql` tag), with the table in `example/scripts/assistant.sql` and `pnpm db:assistant` to create it:

```sql
create table if not exists mnml_assistant_turns (
  id bigint generated always as identity primary key,
  chat_id text not null,
  page text not null,
  at timestamptz not null,
  question text not null,
  answer text not null,
  status text not null,
  model text,
  tools jsonb,
  fills jsonb,
  usage jsonb,
  duration_ms int,
  by text
);
create index if not exists mnml_assistant_turns_page_idx on mnml_assistant_turns (page, at desc);
create index if not exists mnml_assistant_turns_chat_idx on mnml_assistant_turns (chat_id);
```

## What the model can do

| It can | Through |
| --- | --- |
| Read the schema, list entries, read an entry | the same read tools as the [MCP server](https://mnml-cms.vercel.app/agents.md) |
| Search the published content by meaning | `search_content` (needs [`search`](https://mnml-cms.vercel.app/search.md)) |
| Search by keyword, drafts included | `search` |
| Put values in the open entry | `fill_field` and `fill_entry` |
| Anything you add | your own [tools](#your-own-tools) |

The assistant's own tools can't save, publish or delete. Tools you add can do what your code does, so keep them to reading.

Before values reach the form, the server checks each field the way a save does. Rich text can be Markdown. A value that does not fit its field, or a field that does not exist, is left out, and the model is told which and why so it can try again. The panel lists what was left out.

## Limits and safety

- Only signed-in editors can use it: `POST <apiPath>/ai/chat` returns 401 otherwise, and 404 when `ai` is off. `GET <apiPath>/ai/chats?page=` (only with a `store` that has `turns`) is the same.
- 20 questions a minute for each client, per server instance. This is a guard, not a budget: for a real spend cap use the AI Gateway's budgets, or your provider's.
- A request carries at most 30 messages and 60,000 characters. The form's values sent to the model are cut at 40,000 characters.
- Content is data, not instructions: the model is told never to follow instructions it finds in content. Even if it did, it can only fill the open form. The editor sees the result before anything is saved.
- Filled values are **unsaved edits** in the form. A collection entry that already exists autosaves as a draft like any other edit, and the live version only changes when the editor publishes.
- A model that fails does not leak its error to the browser. The detail goes to the server log.

## Options

The options of `assistant()`:

| Option | |
| --- | --- |
| `model` | A Gateway id string or an AI SDK model. Required. |
| `tools` | Your own tools, as an object or a function of the open page. |
| `maxSteps` | Most model turns for one question. Default 6. |
| `store` | Where the record of turns goes, in your database ([Keeping a record](#keeping-a-record)). Default: none, and the panel keeps its chats in the browser. |
| `name` | What the panel and button are called, and what the model calls itself. Default `Assistant`. Up to 40 characters. |
| `tone` | How it writes and answers, in your words. Up to 300 characters. |
