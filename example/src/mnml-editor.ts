import { defineEditor, tools } from '@n3wtou/mnml-cms/editor';

// Shared by the admin (through mnml-editor-client.tsx) and <RichText editor={editor}> on the site.
export const editor = defineEditor({
  tools: [tools.underline, tools.strike, tools.horizontalRule],
});
