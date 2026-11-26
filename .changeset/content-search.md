---
'@n3wtou/mnml-cms': minor
---

Search over published content, for agents and RAG. Off by default; nothing changes for sites that don't turn it on.

- `search: { index }` in `createCms()` adds `cms.search(query, { collections, limit })` and a `search_content` tool on the MCP server (limited to the collections a token can read). It works with any `storage`.
- The index is yours, like image storage: you pass a `SearchIndex` (`put`, `remove`, `query`, optional `prune`) for Postgres, pgvector, Mongo, Convex, Algolia and so on. The package has no index, no embedding code and no database-specific search code. The docs and `example/` have tested adapters to copy: Postgres full-text, and pgvector with OpenAI or Gemini embeddings. Helpers: `searchEntry()`, `fuseMatches()`.
- Each hit is the best passage of one entry: `{ key, slug, title, url, field, snippet, text, score }`. Drafts are never indexed.
- Publish, unpublish and delete keep the index up to date after the response is sent. A failure is logged and never fails a save.
- `cms.search.reindex()` rebuilds the index (an entry that fails is reported in `failed`, not fatal); `createSearch()` from `@n3wtou/mnml-cms/sync` does it from a script. Run it once for existing content.
- `search: { route: ['posts'] }` adds a rate-limited public `GET <apiPath>/search?q=` for those collections (`true`: all of them). Off by default.
