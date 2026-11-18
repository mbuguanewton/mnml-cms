import { Node } from '@tiptap/core';
import { fields } from '@n3wtou/mnml-cms';
import { nodeAttributes } from '@n3wtou/mnml-cms/editor';

/** The YouTube node's values: edited in the admin's form, stored as the node's attributes. */
export const youtubeFields = {
  url: fields.url('YouTube URL', { required: true, help: 'A youtube.com/watch or youtu.be link' }),
  title: fields.text('Title', { help: 'For screen readers; shown if the video can’t load' }),
};

/** The video id in a youtube.com/watch?v=…, youtu.be/… or youtube.com/embed/… URL. */
export function youtubeId(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]);
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** A block-level YouTube embed. On the site it renders through the YouTubeEmbed component (mnml-editor.tsx). */
export const YouTube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  addAttributes: () => nodeAttributes(youtubeFields),
  parseHTML: () => [{ tag: 'div[data-youtube]' }],
  // Plain fallback (a link) for anywhere that has no component for it.
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    { 'data-youtube': '', ...HTMLAttributes },
    ['a', { href: node.attrs.url }, node.attrs.title || node.attrs.url],
  ],
});
