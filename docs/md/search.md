---
title: "Search"
description: "Search published content for RAG and agents: cms.search(), the built-in Postgres full-text index, your own SearchIndex (pgvector, Mongo, Convex, Algolia), the search_content MCP tool, a public route and reindexing."
url: https://mnml-cms.vercel.app/search
---

# Search

Search the published content from your own code, an agent or a RAG pipeline. Off by default.

```ts filename="src/mnml/index.ts"
export const cms = createCms(config, {
  database: neonDatabase(process.env.DATABASE_URL),
  auth: { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET },
  search: true,
});
```

```ts
const hits = await cms.search('how do refunds work', { collections: ['posts'], limit: 5 });
// [{ key, slug, title, url, field, snippet, text, score }]
```

- Each hit is the best passage of one entry, best first.
- `text` is the whole passage (up to about 1,600 characters). Hand it to a model as is.
- `snippet` is a short piece around the match, for a results page.
- `slug` is `null` for a singleton. `url` is the page on your site, or `null`.
- `score`: higher is better. Compare scores only inside one result list.
- Drafts are never indexed or returned. Unpublished and deleted entries drop out.

## How it fits together

The package cuts each published entry into passages and keeps an **index** up to date. Where the index lives and how it searches is a plug, like [image storage](https://mnml-cms.vercel.app/image-storage.md).

| | |
| --- | --- |
| `search: true` | Built-in index: Postgres full-text search (stemming, ranking, no extension, no API key). Needs the `database` option. |
| `search: { index }` | Your own `SearchIndex`: pgvector, Mongo, Convex, Algolia, Typesense, Pinecone… Works with any `storage`. |

The package never embeds anything and has no vector code. Embedding models and vector databases change too often, and sites use different ones.

## Set up the built-in index

1. Turn on `search: true`.
2. Add the search table to `schema` in your drizzle config, then run `drizzle-kit push`. It creates `mnml_chunks`. Sites that leave search off never get it.

```ts filename="drizzle.config.ts"
schema: ['./node_modules/@n3wtou/mnml-cms/dist/server/content/db.js', './node_modules/@n3wtou/mnml-cms/dist/server/search/table.js'],
```
3. Run `await cms.search.reindex()` once, for the content you already have (see [Reindex](#reindex)).

From then on, every publish, unpublish and delete updates the index after the response is sent. A failure is logged and never fails the save.

## Use your own index

A `SearchIndex` has three methods and one optional one:

```ts
import type { SearchIndex } from '@n3wtou/mnml-cms/next';

export const myIndex = (): SearchIndex => ({
  // Replace everything stored for this entry.
  async put({ key, slug, title, url, chunks }) {
    // chunks: [{ field, idx, text, hash }]. Same hash as before: the passage did not change.
  },
  // The entry was unpublished or deleted. `slug` is null for a singleton.
  async remove(key, slug) {},
  // The best passages, best first: [{ key, slug, title, url, field, text, score }]
  async query(q, { collections, limit }) {
    return [];
  },
  // Optional: drop everything not in `live` (used by reindex).
  async prune(live) {},
});
```

```ts
createCms(config, { storage: myStorage, auth, search: { index: myIndex() } });
```

- `put` gets only published entries, never drafts. Skip passages whose `hash` you already hold, so unchanged text is not embedded again.
- `query` may return several passages of one entry. The package keeps the best of each, so it asks for about three times as many passages as results.
- The index can live in another system from the entries. That is the normal case for Algolia and Typesense.
- With a custom `storage` (no Drizzle `database`), `search: true` is not available. Pass an `index`.

Helpers, exported from `@n3wtou/mnml-cms/next` and `/sync`:

- `searchEntry(config, key, slug, data)`: the title, link and passages of one entry, if you want to feed an index yourself.
- `fuseMatches([keywordMatches, vectorMatches])`: merges ranked lists (reciprocal rank fusion), for hybrid search.
- `postgresSearch({ database })`: the built-in index, to wrap or learn from.

### Search by meaning with pgvector

The repo's example has a tested adapter that adds vectors to the built-in index and merges both with `fuseMatches`: [`pgvector-search.ts`](https://github.com/mbuguanewton/mnml-cms/blob/main/example/src/mnml/pgvector-search.ts) and its table, [`pgvector-schema.ts`](https://github.com/mbuguanewton/mnml-cms/blob/main/example/src/mnml/pgvector-schema.ts). Copy them and pick or swap the `embed` function for your provider. The file has `openaiEmbed()` and `geminiEmbed()` (both small `fetch` calls; Gemini is tested against the real API, including a Spanish query finding English text). Voyage, Cohere or a local model work the same.

```ts
search: { index: pgvectorSearch({ database: neonDatabase(process.env.DATABASE_URL), embed: openaiEmbed(), model: 'text-embedding-3-small' }) },
```

1. `create extension if not exists vector;` (Neon, Supabase and most hosts have pgvector).
2. Add `pgvector-schema.ts` to `schema` in your drizzle config, then `drizzle-kit push`.
3. `cms.search.reindex()`. Run it again when you change the model: the model is stored with each vector, so old and new vectors are never mixed.

Good to know:

- Vector search always returns the nearest entries, even for a query with no real match. Cut by `score` or show fewer results if that matters.
- Embed in `put`, after the words are stored, so a provider outage never makes new content unsearchable.
- If embedding the query fails, answer from the words only.

### Other databases

The pieces are the same everywhere: store passages on `put`, delete them on `remove`, search them on `query`.

- **Postgres without pgvector:** the built-in index.
- **MongoDB:** an Atlas Search index (text) and Atlas Vector Search on a collection of passages. `put`: delete the entry's passages and insert the new ones. `query`: `$search` and/or `$vectorSearch`.
- **Convex:** a table of passages with a search index and a vector index. `put` and `remove` call mutations, `query` calls a query function.
- **Firebase:** Firestore has no full-text or vector search. Use Typesense, Algolia, Meilisearch or Vertex AI Vector Search as the index.
- **Hosted vector databases** (Pinecone, Turbopuffer, Qdrant): `put` upserts vectors with the passage as metadata, `remove` deletes by entry, `query` embeds and searches.

These are not shipped as packages: your database, your embeddings, your adapter.

## Reindex

`reindex()` puts every published entry into the index, then calls `prune`. Run it:

- after turning `search` on for a site with content,
- after [moving content](https://mnml-cms.vercel.app/moving-content.md) between databases,
- after changing your embedding model or adapter.

```ts
const { entries, chunks, failed } = await cms.search.reindex();
```

One entry that fails (say, your embedding provider rejects it) does not stop the rest. It is listed in `failed` as `{ key, slug, message }`, and its old passages are kept. Run `reindex()` again to retry.

Scripts and cron jobs can run it without Next.js:

```ts filename="scripts/reindex.ts"
import { createSearch, neonDatabase } from '@n3wtou/mnml-cms/sync';
import config from '../mnml.config';

const { failed } = await createSearch(config, { database: neonDatabase(process.env.DATABASE_URL) }).reindex();
if (failed.length) process.exitCode = 1;
```

Pass the same `search` options you gave `createCms` (`index`, `table`, `language`), and `storage` instead of `database` for a custom storage.

## What gets indexed

- Text, textarea, rich text and tags fields, also inside groups, lists and blocks.
- Not the title field (every passage carries the entry's title instead), numbers, dates, links, images, selects or references.
- Long fields are split at paragraphs and sentences into passages of about 400 tokens.

## For agents

With the [MCP server](https://mnml-cms.vercel.app/agents.md) on, agents get a `search_content` tool (scope `read`). It returns the best passages with their entry, field, link and text, limited to the collections the token can read. The older `search` tool stays: it finds exact text in the latest versions, drafts included, for editing.

## Public route

```ts
search: { route: ['posts', 'pages'] },
```

Turns on `GET <apiPath>/search?q=…&collections=posts&limit=10` (JSON `{ ok, results }`). It answers anyone, with the full text of each passage, so it is off by default.

- `route: true` searches every collection and singleton. A list of keys limits it to those. Use the list: a collection you publish but never show on the site would otherwise be searchable.
- `cms.search()` in your own code is never limited by the list.
- `q` up to 200 characters. `limit` up to 20. Only published content.
- 30 searches a minute for each client and 300 in all. Over that: `429` with `Retry-After`.
- The counts are kept in memory on each server, and clients are told apart by `x-forwarded-for`. Treat it as a guard, not a quota. If the index costs money per search, also limit the route at your host or CDN.

## Options

| Option | Default | |
| --- | --- | --- |
| `index` | built-in Postgres | Your own `SearchIndex`. Needed with a custom `storage`. |
| `route` | `false` | Turns on the public route: `true` (everything) or a list of collection keys. |
| `table` | `'mnml_chunks'` | The built-in index's table. Match `chunksTable({ name })`. |
| `language` | `'english'` | The built-in index's Postgres text search configuration, e.g. `'simple'` or `'german'`. Match `chunksTable({ language })`. |
