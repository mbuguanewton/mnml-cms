import { defineEditor, tools } from '@n3wtou/mnml-cms/editor';
import { CodeBlock } from './components/code-block';

// Shared by the admin (through mnml-editor-client.tsx) and <RichText editor={editor}> on the site.
export const editor = defineEditor({
  tools: [tools.underline, tools.strike, tools.horizontalRule],
  // How <RichText> renders these nodes on the site (plain components only: the admin loads this file too).
  components: { codeBlock: CodeBlock },
});
