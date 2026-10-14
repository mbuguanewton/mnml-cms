import { MinusIcon, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
import type { EditorTool } from './editor.js';

// Buttons for marks and nodes StarterKit already has in the schema, so they need no extra extension.
export const tools = {
  underline: {
    name: 'underline',
    label: 'Underline',
    group: 'format',
    icon: <UnderlineIcon />,
    isActive: (e) => e.isActive('underline'),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  strike: {
    name: 'strike',
    label: 'Strikethrough',
    group: 'format',
    icon: <StrikethroughIcon />,
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  horizontalRule: {
    name: 'horizontalRule',
    label: 'Horizontal rule',
    group: 'insert',
    icon: <MinusIcon />,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
} satisfies Record<string, EditorTool>;
