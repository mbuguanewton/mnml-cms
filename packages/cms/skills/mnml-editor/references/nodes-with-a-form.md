<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# Nodes with a form

Some nodes need values: an embed's URL, a callout's tone. `tools.node()` makes a button that opens a form in a dialog, validates it like an entry, and inserts the node.

In the editor, the node is a card with a one-line preview. Double-click or press Edit to change it.

## 1. Define the node

Once, with its form fields, in a plain module the editor config and the site both import. `nodeAttributes(fields)` gives one attribute per field: starts empty, kept in HTML as `data-<name>`.

```ts filename="src/youtube.ts"
import { Node } from '@tiptap/core';
import { fields } from '@n3wtou/mnml-cms';
import { nodeAttributes } from '@n3wtou/mnml-cms/editor';

export const youtubeFields = {
  url: fields.url('YouTube URL', { required: true }),
  title: fields.text('Title'),
};

export const YouTube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true, // a form node has no editable content of its own
  addAttributes: () => nodeAttributes(youtubeFields),
  parseHTML: () => [{ tag: 'div[data-youtube]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-youtube': '', ...HTMLAttributes }],
});
```

## 2. Add the button

```tsx filename="src/mnml-editor.tsx"
export const editor = defineEditor({
  extensions: [YouTube],
  tools: [
    tools.node({
      name: 'youtube',
      label: 'YouTube video',
      icon: <CirclePlayIcon />,
      group: 'insert',
      fields: youtubeFields,
      preview: (attrs) => attrs.url ?? '',
    }),
  ],
  components: { youtube: YouTubeEmbed },
});
```

- `name`: the node's name.
- `preview`: optional, the card's line.
- `components`: how `<RichText>` renders it on the site ([Custom node rendering](https://mnml-cms.vercel.app/editor/custom-rendering)).

## Form fields

- Allowed: `text`, `textarea`, `url`, `number`, `boolean`, `select`, `date`, `reference` (the slug). Values that fit node attributes.
- `required`, `help`, `showIf` work as in entries.

## Dialogs in any tool

`run` gets the editor and the dialogs `form`, `confirm`, `alert`. Any tool can use them.

```ts
run: async (editor, { form, confirm, alert }) => {
  const values = await form({ title: 'Callout', fields: calloutFields, submitLabel: 'Insert' }); // null if cancelled
  if (values) editor.chain().focus().insertContent({ type: 'callout', attrs: values }).run();
};
```
