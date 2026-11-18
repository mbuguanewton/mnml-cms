import { Node, type JSONContent } from '@tiptap/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { defineEditor, type RichTextNodeProps } from './editor.js';
import { RichText } from './rich-text-render.js';

const text = (t: string) => ({ type: 'text', text: t });
const p = (t: string) => ({ type: 'paragraph', content: [text(t)] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const code = (language: string, t: string) => ({ type: 'codeBlock', attrs: { language }, content: [text(t)] });

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

const CodeBlock = ({ attrs, children }: RichTextNodeProps) => (
  <figure data-lang={String(attrs.language)}>
    <pre>{children}</pre>
  </figure>
);

// A custom node, like a site's Note callout.
const Note = Node.create({
  name: 'note',
  group: 'block',
  content: 'inline*',
  addAttributes: () => ({ tone: { default: 'info' } }),
  renderHTML: ({ HTMLAttributes }) => ['aside', HTMLAttributes, 0],
});
const note = (tone: string, t: string) => ({ type: 'note', attrs: { tone }, content: [text(t)] });

describe('RichText components', () => {
  it('renders without components exactly as before', () => {
    expect(html(<RichText content={doc(p('Hi'), code('ts', 'let a'))} />)).toBe('<div><p>Hi</p><pre><code class="language-ts">let a</code></pre></div>');
  });

  it('renders a mapped node with the component, passing attrs and children', () => {
    const out = html(<RichText content={doc(p('Hi'), code('ts', 'let a'))} components={{ codeBlock: CodeBlock }} />);
    expect(out).toBe('<div><p>Hi</p><figure data-lang="ts"><pre>let a</pre></figure></div>');
  });

  it('passes the node as Tiptap JSON', () => {
    let seen: JSONContent | undefined;
    const Spy = ({ node }: RichTextNodeProps) => {
      seen = node;
      return null;
    };
    html(<RichText content={doc(code('ts', 'let a'))} components={{ codeBlock: Spy }} />);
    expect(seen).toEqual({ type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'let a' }] });
  });

  it('uses components from the editor config, with the per-call prop winning per node', () => {
    const editor = defineEditor({ components: { codeBlock: CodeBlock, paragraph: ({ children }) => <p className="lead">{children}</p> } });
    const Plain = ({ children }: RichTextNodeProps) => <pre className="plain">{children}</pre>;
    const out = html(<RichText content={doc(p('Hi'), code('ts', 'x'))} editor={editor} components={{ codeBlock: Plain }} />);
    expect(out).toBe('<div><p class="lead">Hi</p><pre class="plain">x</pre></div>');
  });

  it('renders a custom extension node through its component, or its renderHTML when unmapped', () => {
    const editor = defineEditor({ extensions: [Note] });
    const content = doc(note('warn', 'Careful'));
    expect(html(<RichText content={content} editor={editor} />)).toBe('<div><aside tone="warn">Careful</aside></div>');
    const Callout = ({ attrs, children }: RichTextNodeProps) => (
      <div role="note" className={`note-${String(attrs.tone)}`}>
        {children}
      </div>
    );
    expect(html(<RichText content={content} editor={editor} components={{ note: Callout }} />)).toBe(
      '<div><div role="note" class="note-warn">Careful</div></div>',
    );
  });

  it('gives leaf nodes no children', () => {
    let seen: unknown = 'unset';
    const Img = ({ children }: RichTextNodeProps) => ((seen = children), null);
    html(<RichText content={doc({ type: 'image', attrs: { src: '/a.png' } })} components={{ image: Img }} />);
    expect(seen).toBeUndefined();
  });

  it('ignores components for nodes the content does not use or the schema does not have', () => {
    expect(html(<RichText content={doc(p('Hi'))} components={{ youtube: () => <iframe /> }} />)).toBe('<div><p>Hi</p></div>');
  });

  it('accepts async (server) components in the type', () => {
    const Async = async ({ attrs }: RichTextNodeProps) => <span>{String(attrs.language)}</span>;
    // Type-level check: async components are allowed; rendering them needs a server component renderer.
    expect(typeof (<RichText content={doc()} components={{ codeBlock: Async }} />)).toBe('object');
  });
});
