import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import type { ReactNode } from 'react';
import type { EditorConfig, RichTextComponents } from './editor.js';
import { resolveExtensions } from './rich-text.js';

export type { RichTextComponents, RichTextNodeProps } from './editor.js';

type NodeRenderer = (props: { node: PMNode; children?: ReactNode | ReactNode[] }) => ReactNode;

/** Adapts the site's components to the static renderer, which passes ProseMirror nodes. */
function nodeMapping(components: RichTextComponents): Record<string, NodeRenderer> {
  return Object.fromEntries(
    Object.entries(components).map(([name, Component]): [string, NodeRenderer] => [
      name,
      // The renderer passes [] for leaf nodes (images…); components get no children for those.
      ({ node, children }) => (
        <Component node={node.toJSON() as JSONContent} attrs={node.attrs}>
          {Array.isArray(children) && children.length === 0 ? undefined : children}
        </Component>
      ),
    ]),
  );
}

/**
 * Renders a rich-text field on the server, with the same schema as the editor. Style it via `className`.
 * Pass the site's `editor` config (from `defineEditor`) when it adds extensions or `components`.
 *
 * `components` renders the named nodes with your own React components, on top of (and overriding, per node) the
 * editor config's `components`. Put async server components here rather than in the editor config, which the
 * admin also loads in the browser. Other nodes render through their extension's `renderHTML`.
 */
export function RichText({
  content,
  className,
  editor,
  components,
}: {
  content: JSONContent;
  className?: string;
  editor?: EditorConfig;
  components?: RichTextComponents;
}) {
  const mapped = { ...editor?.components, ...components };
  return (
    <div className={className}>
      {renderToReactElement({
        content,
        extensions: resolveExtensions(editor),
        options: Object.keys(mapped).length ? { nodeMapping: nodeMapping(mapped) } : undefined,
      })}
    </div>
  );
}
