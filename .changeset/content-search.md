---
'@n3wtou/mnml-cms': minor
---

Search over published content, for agents and RAG. Off by default; nothing changes for sites that don't turn it on.

- `search: true` in `createCms()` adds `cms.search(query, { collections, limit })` and a `search_content` tool on the MCP server (limited to the collections a token can read). The built-in index is Postgres full-text search: no API key, no extension.
- The index is a plug, like image storage: `search: { index }` takes your own `SearchIndex` (`put`, `remove`, `query`, optional `prune`) for vectors, Mongo, Convex, Algolia and so on, and works with any `storage`. The package has no embedding or vector code; `example/src/mnml/pgvector-search.ts` is a tested pgvector adapter to copy. Helpers: `searchEntry()`, `fuseMatches()`, `postgresSearch()`.
- Each hit is the best passage of one entry: `{ key, slug, title, url, field, snippet, text, score }`. Drafts are never indexed.
- Publish, unpublish and delete keep the index up to date after the response is sent. A failure is logged and never fails a save.
- `cms.search.reindex()` rebuilds the index; `createSearch()` from `@n3wtou/mnml-cms/sync` does it from a script. Run it once for existing content.
- `search: { route: ['posts'] }` adds a rate-limited public `GET <apiPath>/search?q=` for those collections (`true`: all of them). Off by default.

To turn on the built-in index: add `search: true`, add `./node_modules/@n3wtou/mnml-cms/dist/server/search/table.js` to `schema` in your drizzle config and run `drizzle-kit push` (it creates `mnml_chunks`; sites that leave search off get no new table), then call `cms.search.reindex()` once.
