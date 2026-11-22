import { Node, type Attribute } from '@tiptap/core';

const attr = (name: string): Attribute => ({
  default: null,
  parseHTML: (el) => el.getAttribute(`data-${name}`),
  renderHTML: (attrs) => (attrs[name] ? { [`data-${name}`]: String(attrs[name]) } : {}),
});

/**
 * A node that links to an entry: a block with `collection` and `slug` attributes, for `tools.reference()`. On the
 * site, render it with a `<RichText components>` entry for `name`; without one it renders as an empty
 * `<div data-reference data-collection data-slug>`.
 */
export function referenceNode({ name }: { name: string }) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    addAttributes: () => ({ collection: attr('collection'), slug: attr('slug') }),
    parseHTML: () => [{ tag: `div[data-reference="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', { 'data-reference': name, ...HTMLAttributes }],
  });
}
