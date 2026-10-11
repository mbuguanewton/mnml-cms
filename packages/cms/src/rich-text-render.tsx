import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import { extensions } from './rich-text.js';

/** Renders a rich-text field on the server, with the same schema as the editor. Style it via `className`. */
export function RichText({ content, className }: { content: JSONContent; className?: string }) {
  return <div className={className}>{renderToReactElement({ content, extensions })}</div>;
}
