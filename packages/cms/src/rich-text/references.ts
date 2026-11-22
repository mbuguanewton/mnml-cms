import type { JSONContent } from '@tiptap/core';

/** Entries that rich text links to, by collection: what `collectReferences` returns. */
export type RichTextReferences = { collection: string; slugs: string[] }[];

/**
 * Every entry a rich-text document references (nodes with string `collection` and `slug` attributes, as inserted
 * by `tools.reference()`), grouped by collection and deduplicated, in document order. Load them in one go before
 * rendering, then look them up in the node's component. Pass `nodes` to only count those node types.
 */
export function collectReferences(doc: JSONContent | null | undefined, nodes?: string[]): RichTextReferences {
  const found = new Map<string, Set<string>>();
  const walk = (node: JSONContent) => {
    const { collection, slug } = (node.attrs ?? {}) as Record<string, unknown>;
    if (typeof collection === 'string' && typeof slug === 'string' && slug && (!nodes || nodes.includes(node.type ?? ''))) {
      if (!found.has(collection)) found.set(collection, new Set());
      found.get(collection)!.add(slug);
    }
    for (const child of node.content ?? []) walk(child);
  };
  if (doc) walk(doc);
  return [...found].map(([collection, slugs]) => ({ collection, slugs: [...slugs] }));
}
