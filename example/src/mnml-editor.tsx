import { defineEditor, referenceNode, tools } from '@n3wtou/mnml-cms/editor';
import { CirclePlayIcon, FileSymlinkIcon } from 'lucide-react';
import { CodeBlock } from './components/code-block';
import { YouTubeEmbed } from './components/youtube-embed';
import { YouTube, youtubeFields } from './youtube';

// Shared by the admin (through mnml-editor-client.tsx) and <RichText editor={editor}> on the site.
export const editor = defineEditor({
  // blockLink: a card linking another post. Rendering it needs the post's data, so the post page passes it.
  extensions: [YouTube, referenceNode({ name: 'blockLink' })],
  tools: [
    tools.underline,
    tools.strike,
    tools.horizontalRule,
    // A button that asks for the URL and title in a form, then inserts the node; it shows as an editable card.
    tools.node({ name: 'youtube', label: 'YouTube video', icon: <CirclePlayIcon />, group: 'insert', fields: youtubeFields, preview: (a) => a.url ?? '' }),
    // Picks a published post and inserts a blockLink to it; shows as a card with the post's title.
    tools.reference({ name: 'blockLink', label: 'Link a post', icon: <FileSymlinkIcon />, collection: 'posts', group: 'insert' }),
  ],
  // How <RichText> renders these nodes on the site (plain components only: the admin loads this file too).
  components: { codeBlock: CodeBlock, youtube: YouTubeEmbed },
});
