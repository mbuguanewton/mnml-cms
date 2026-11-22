import type { JSONContent } from '@tiptap/core';

/** The text of a rich-text field, blocks separated by spaces. For derived values like word counts. */
export function plainText(doc: JSONContent | null | undefined): string {
  return walk(doc).replace(/\s+/g, ' ').trim();
}

function walk(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  const kids = node.content ?? [];
  // Inline runs (bold, links…) join directly; blocks are separated by a space.
  const inline = kids.every((k) => k.type === 'text');
  return kids.map(walk).join(inline ? '' : ' ');
}

/** Whole minutes to read a rich-text field (at least 1). */
export function readingTime(doc: JSONContent | null | undefined, wordsPerMinute = 220): number {
  const words = plainText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
