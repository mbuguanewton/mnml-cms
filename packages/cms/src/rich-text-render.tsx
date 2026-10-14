import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import type { EditorConfig } from './editor.js';
import { resolveExtensions } from './rich-text.js';

/**
 * Renders a rich-text field on the server, with the same schema as the editor. Style it via `className`.
 * Pass the site's `editor` config (from `defineEditor`) when it adds extensions.
 */
export function RichText({ content, className, editor }: { content: JSONContent; className?: string; editor?: EditorConfig }) {
  return <div className={className}>{renderToReactElement({ content, extensions: resolveExtensions(editor) })}</div>;
}
