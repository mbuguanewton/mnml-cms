import type { Editor, JSONContent } from '@tiptap/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vite-plus/test';
import { defineEditor, type RichTextNodeProps, type ToolContext } from './editor.js';
import { tools } from './editor-tools.js';
import { referenceNode } from './reference-node.js';
import { collectReferences } from './references.js';
import { RichText } from './rich-text-render.js';

const link = (collection: string, slug: string, type = 'blockLink'): JSONContent => ({ type, attrs: { collection, slug } });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('collectReferences', () => {
  it('groups referenced slugs by collection, deduplicated, in document order', () => {
    const content = doc(link('posts', 'b'), p({ type: 'text', text: 'hi' }), link('posts', 'a'), link('authors', 'ada'), link('posts', 'b'));
    expect(collectReferences(content)).toEqual([
      { collection: 'posts', slugs: ['b', 'a'] },
      { collection: 'authors', slugs: ['ada'] },
    ]);
  });

  it('finds references nested in other nodes', () => {
    const content = doc(
      { type: 'blockquote', content: [link('posts', 'deep')] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [link('posts', 'deeper')] }] },
    );
    expect(collectReferences(content)).toEqual([{ collection: 'posts', slugs: ['deep', 'deeper'] }]);
  });

  it('ignores nodes without a string collection and slug, and empty documents', () => {
    expect(
      collectReferences(doc({ type: 'image', attrs: { src: '/a.png' } }, link('posts', ''), { type: 'x', attrs: { collection: 'posts', slug: 3 } })),
    ).toEqual([]);
    expect(collectReferences(null)).toEqual([]);
  });

  it('only counts the given node types', () => {
    expect(collectReferences(doc(link('posts', 'a'), link('posts', 'b', 'other')), ['blockLink'])).toEqual([{ collection: 'posts', slugs: ['a'] }]);
  });
});

describe('referenceNode', () => {
  const BlockLink = referenceNode({ name: 'blockLink' });
  const editor = defineEditor({ extensions: [BlockLink] });

  it('renders a plain fallback with its attributes', () => {
    expect(renderToStaticMarkup(<RichText editor={editor} content={doc(link('posts', 'hello'))} />)).toBe(
      '<div><div data-reference="blockLink" data-collection="posts" data-slug="hello"></div></div>',
    );
  });

  it('renders through a component, which gets collection and slug', () => {
    const Card = ({ attrs }: RichTextNodeProps) => <a href={`/${String(attrs.collection)}/${String(attrs.slug)}`}>card</a>;
    expect(renderToStaticMarkup(<RichText editor={editor} content={doc(link('posts', 'hello'))} components={{ blockLink: Card }} />)).toBe(
      '<div><a href="/posts/hello">card</a></div>',
    );
  });
});

describe('tools.reference', () => {
  const tool = tools.reference({ name: 'blockLink', label: 'Link a post', icon: null, collection: 'posts', group: 'insert' });
  const fakeEditor = () => {
    const inserted: unknown[] = [];
    const chain = { focus: () => chain, insertContent: (c: unknown) => (inserted.push(c), chain), run: () => true };
    return { editor: { chain: () => chain } as unknown as Editor, inserted };
  };
  const admin = (result: Record<string, unknown> | null) => ({ form: vi.fn(async () => result), confirm: vi.fn(), alert: vi.fn() }) as unknown as ToolContext;

  it('asks for a required entry of the collection', async () => {
    const ctx = admin(null);
    await tool.run(fakeEditor().editor, ctx);
    expect(ctx.form).toHaveBeenCalledWith({
      title: 'Link a post',
      fields: { slug: { type: 'reference', label: 'Link a post', collection: 'posts', required: true } },
      submitLabel: 'Insert',
    });
  });

  it('inserts the node with the collection and the picked slug', async () => {
    const { editor, inserted } = fakeEditor();
    await tool.run(editor, admin({ slug: 'hello' }));
    expect(inserted).toEqual([{ type: 'blockLink', attrs: { collection: 'posts', slug: 'hello' } }]);
  });

  it('inserts nothing when cancelled', async () => {
    const { editor, inserted } = fakeEditor();
    await tool.run(editor, admin(null));
    expect(inserted).toEqual([]);
  });
});
