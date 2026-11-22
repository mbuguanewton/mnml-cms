'use client';

// Picker options for reference fields outside an entry's own fields (node forms, editor cards), from the
// `references` route. Kept apart from fields.tsx so the rich-text editor's cards can use it without a cycle.
import { useEffect, useState } from 'react';
import type { RefOptions } from './fields.js';

type Post = <T>(route: string, body: unknown) => Promise<T>;
const cache = new Map<string, Promise<RefOptions[string]>>();

/** Published entries of these collections. Cached per collection; `fresh` refetches (e.g. when a form opens). */
export async function fetchRefOptions(post: Post, collections: string[], fresh = false): Promise<RefOptions> {
  const missing = collections.filter((c) => fresh || !cache.has(c));
  if (missing.length) {
    const request = post<{ ok: boolean; options?: RefOptions }>('references', { collections: missing }).then((r) => r.options ?? {});
    for (const c of missing)
      cache.set(
        c,
        request.then((o) => o[c] ?? []).catch(() => (cache.delete(c), [])),
      );
  }
  return Object.fromEntries(await Promise.all(collections.map(async (c) => [c, await cache.get(c)!] as const)));
}

/** The title of a referenced entry (its slug until loaded, or if it's no longer published). */
export function useRefLabel(post: Post, collection: string | undefined, slug: unknown): string {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!collection || typeof slug !== 'string' || !slug) return;
    let live = true;
    void fetchRefOptions(post, [collection]).then((o) => live && setLabel(o[collection]?.find((x) => x.slug === slug)?.label ?? null));
    return () => {
      live = false;
    };
  }, [post, collection, slug]);
  return label ?? (typeof slug === 'string' ? slug : '');
}
