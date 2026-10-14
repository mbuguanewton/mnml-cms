import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import type { Extensions } from '@tiptap/core';
import type { EditorConfig } from './editor.js';

// Shared by the editor and the server renderer so both see the same schema.
// StarterKit v3 already bundles Link.
export const extensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['mailto'] },
  }),
  Image,
];

/** The defaults plus the site's extensions (or whatever its function form returns). */
export function resolveExtensions(config?: EditorConfig): Extensions {
  const own = config?.extensions;
  if (typeof own === 'function') return own(extensions);
  return own ? [...extensions, ...own] : extensions;
}
