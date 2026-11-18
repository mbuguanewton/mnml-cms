import { defineEditor, tools } from '@n3wtou/mnml-cms/editor';
import { CirclePlayIcon } from 'lucide-react';
import { CodeBlock } from './components/code-block';
import { YouTubeEmbed } from './components/youtube-embed';
import { YouTube, youtubeFields } from './youtube';

// Shared by the admin (through mnml-editor-client.tsx) and <RichText editor={editor}> on the site.
export const editor = defineEditor({
  extensions: [YouTube],
  tools: [
    tools.underline,
    tools.strike,
    tools.horizontalRule,
    // A button that asks for the URL and title in a form, then inserts the node; it shows as an editable card.
    tools.node({ name: 'youtube', label: 'YouTube video', icon: <CirclePlayIcon />, group: 'insert', fields: youtubeFields, preview: (a) => a.url ?? '' }),
  ],
  // How <RichText> renders these nodes on the site (plain components only: the admin loads this file too).
  components: { codeBlock: CodeBlock, youtube: YouTubeEmbed },
});
