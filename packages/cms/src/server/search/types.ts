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
  /** Stable and unique, e.g. `posts/hello`, or `settings/` for a singleton: use it as the object ID, primary key or ID prefix. */
  id: string;
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
 * Where passages are stored and searched: Postgres full-text, pgvector, Mongo Atlas Search, Convex, Algolia,
 * Typesense, Pinecone… The package has no index of its own: you write this (the docs have examples), so it owns the
 * database, the embeddings and everything else that varies. The package only hands it published entries, never drafts.
 */
export type SearchIndex = {
  /**
   * Replaces everything indexed for this entry: add its passages, drop the ones it no longer has. Run the delete and
   * the insert as one statement or transaction where you can, so two saves of one entry cannot interleave. Compare
   * each chunk's `hash` if you want to skip work (embedding, mostly) for passages that did not change.
   */
  put(entry: SearchEntry): Promise<void>;
  /** Drops the entry: it was unpublished or deleted. `id` is the `id` that `put` got. */
  remove(id: string): Promise<void>;
  /** The best passages for `q`, best first, at most `limit`. The package asks for a few times more passages than the results it shows, because it keeps only the best passage of each entry. */
  query(q: string, o: { collections?: string[]; limit: number }): Promise<SearchMatch[]>;
  /** Optional. Drops every entry whose id is not in `live` (used by `reindex()`, for entries removed while indexing was off). */
  prune?(live: string[]): Promise<void>;
};

export type SearchOptions = {
  /** Where passages go. Required: see the docs for examples. */
  index: SearchIndex;
  /**
   * Turns on the public `GET <apiPath>/search?q=`. Off by default: a search may cost an embedding call, and it answers
   * anyone. `true` searches every collection and singleton; a list of keys limits it to those, e.g. `['posts']`.
   */
  route?: boolean | string[];
};
