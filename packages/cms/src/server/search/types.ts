/** One passage of an entry. */
export type SearchChunk = {
  field: string;
  /** 0, 1, 2… in reading order within the entry. */
  idx: number;
  text: string;
  /** Of the title, url, field and text: when it is the same as before, the passage did not change. */
  hash: string;
};

/** A published entry, cut into passages, as it goes into the index. */
export type SearchEntry = {
  key: string;
  /** Null for a singleton. */
  slug: string | null;
  title: string;
  /** Where the entry is on the site (`basePath/<slug>`, or the singleton's `preview` path), or null. */
  url: string | null;
  chunks: SearchChunk[];
};

/** A passage that matched a query. */
export type SearchMatch = {
  key: string;
  /** Null for a singleton. */
  slug: string | null;
  title: string;
  url: string | null;
  /** The top-level field the passage is from. */
  field: string;
  /** The whole passage (up to about 1,600 characters), ready to hand to a model. */
  text: string;
  /** Higher is better. Only comparable within one result list. */
  score: number;
};

export type SearchHit = SearchMatch & {
  /** A short piece of `text` around the match, for a results page. */
  snippet: string;
};

export type SearchQuery = {
  /** Only these singletons and collections. Default: all. */
  collections?: string[];
  /** Default 10, at most 50. */
  limit?: number;
};

/**
 * Where passages are stored and searched: Postgres full-text (the built-in `postgresSearch`), pgvector, Mongo Atlas
 * Search, Convex, Algolia, Typesense, Pinecone… It owns embeddings and everything else that varies. The package
 * only hands it published entries, and never drafts.
 */
export type SearchIndex = {
  /** Replaces everything indexed for this entry (add new passages, update changed ones, drop the rest). Compare `hash` to skip passages that did not change. */
  put(entry: SearchEntry): Promise<void>;
  /** Drops the entry: it was unpublished or deleted. `slug` is null for a singleton. */
  remove(key: string, slug: string | null): Promise<void>;
  /** The best passages for `q`, best first, at most `limit`. The package asks for a few times more passages than the results it shows, because it keeps only the best passage of each entry. */
  query(q: string, o: { collections?: string[]; limit: number }): Promise<SearchMatch[]>;
  /** Optional. Drops every entry not in `live` (used by `reindex()`, for entries removed while indexing was off). */
  prune?(live: { key: string; slug: string | null }[]): Promise<void>;
};

export type SearchOptions = {
  /** Where passages go. Default: Postgres full-text search in your `database`. Needed with a custom `storage`. */
  index?: SearchIndex;
  /**
   * Turns on the public `GET <apiPath>/search?q=`. Off by default: a search may cost an embedding call, and it answers
   * anyone. `true` searches every collection and singleton; a list of keys limits it to those, e.g. `['posts']`.
   */
  route?: boolean | string[];
  /** The built-in index's table. Default 'mnml_chunks'. */
  table?: string;
  /** The built-in index's Postgres text search configuration, e.g. 'english' (default) or 'simple'. Must match `chunksTable`. */
  language?: string;
};
