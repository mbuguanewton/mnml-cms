---
name: mnml-editor
description: "Extending the mnml rich text editor: Tiptap extensions, toolbar tools, tables, form nodes, entry links, custom node rendering."
---

<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

> Matches the installed version. Online: https://mnml-cms.vercel.app/editor

# Extending the editor

Add Tiptap extensions and toolbar buttons.

The editor (browser) and `<RichText>` (server) need the same extensions. So the config is a plain module both import (no `'use client'`):

```ts filename="src/mnml-editor.ts"
import { defineEditor, tools } from '@n3wtou/mnml-cms/editor';

export const editor = defineEditor({
  extensions: [], // added to the defaults (StarterKit + Image)
  tools: [tools.underline, tools.strike, tools.horizontalRule],
});
```

A client file wraps it for the admin:

```tsx filename="src/mnml-editor-client.tsx"
'use client';
import { editorProvider } from '@n3wtou/mnml-cms/admin';
import { editor } from './mnml-editor';
export const Editor = editorProvider(editor);
```

Then pass `editor: Editor` to `createCms`, and `editor={editor}` to every `<RichText>`:

```tsx
<RichText content={post.content} editor={editor} />
```

One config for every rich text field. Not per field: extensions can't travel in the schema sent to the admin.

## Ready-made tools

`tools.underline`, `tools.strike`, `tools.horizontalRule`: buttons for StarterKit features. No extension needed.

## Your own tools

A tool is an object:

```ts
type EditorTool = {
  name: string;
  label: string;
  icon: ReactNode;
  run: (editor: Editor, admin: ToolContext) => void;
  isActive?: (editor: Editor) => boolean;
  disabled?: (editor: Editor) => boolean;
  visible?: (editor: Editor) => boolean;
  context?: string;
  builtIn?: boolean;
  group?: 'format' | 'block' | 'insert';
};
```

| Property | Does |
| --- | --- |
| `name` | Unique. React key. |
| `label` | Tooltip, accessible name |
| `run` | On click. `admin` has `form()`, `confirm()`, `alert()` ([Nodes with a form](https://mnml-cms.vercel.app/editor/nodes-with-a-form)). |
| `isActive` | Shows pressed |
| `disabled` | Disables |
| `visible` | Shown only when true |
| `context` | A node name: the tool shows in a mini toolbar above that node while the cursor is in it. |
| `builtIn` | Set on the package's tools |
| `group` | Toolbar group. None: own group at the end. |

`run`, `isActive`, `disabled`, `visible` get the live Tiptap editor.

## Toolbar groups

In order: undo/redo, text style menu (paragraph, headings, quote), `format` (bold, italic, code), `block` (lists), `insert` (link, image).

- `tools.underline`, `tools.strike`: `format`. `tools.horizontalRule`: `insert`.
- In each group, package tools (`tools.underline`, `tables.tools`…) first, then yours in listed order.

## Example: code blocks with syntax highlighting

Swap StarterKit's plain code block for [`CodeBlockLowlight`](https://tiptap.dev/docs/editor/extensions/nodes/code-block-lowlight) and add a button. To replace or remove a default extension, pass a function: it gets the defaults and returns the full list.

```tsx filename="src/mnml-editor.tsx"
import { defineEditor } from '@n3wtou/mnml-cms/editor';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SquareCodeIcon } from 'lucide-react';

export const editor = defineEditor({
  extensions: (defaults) => [
    ...defaults.map((ext) => (ext.name === 'starterKit' ? ext.configure({ codeBlock: false }) : ext)),
    CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
  ],
  tools: [
    {
      name: 'codeBlock',
      label: 'Code block',
      group: 'block',
      icon: <SquareCodeIcon />,
      isActive: (e) => e.isActive('codeBlock'),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
  ],
});
```

Highlighting shows in the editor only. `<RichText>` renders `<pre><code class="language-…">`: highlight it on the site yourself, or leave it plain.

## More

- [Tables](references/tables.md): Tables in rich text with @n3wtou/mnml-cms/table.
- [Nodes with a form](references/nodes-with-a-form.md): Custom rich text nodes edited through a form (tools.node, nodeAttributes).
- [Linking entries from rich text](references/linking-entries.md): Link to other entries from rich text with the reference tool and referenceNode.
- [Custom node rendering](references/custom-rendering.md): Render rich text nodes with your own React components on the site.
