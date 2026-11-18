---
'@n3wtou/mnml-cms': minor
---

`<RichText>` can render nodes with your own React components. Map node names to components in `defineEditor({ components })` (used by every `<RichText editor={editor}>`) or pass `components` to one `<RichText>`, which wins for the same node. Each component gets the node as Tiptap JSON, its `attrs` and its rendered `children`. Nodes without a component render through `renderHTML` as before. New types: `RichTextComponents` and `RichTextNodeProps` from `@n3wtou/mnml-cms/editor`.
