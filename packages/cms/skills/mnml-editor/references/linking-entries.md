<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# Linking entries from rich text

Link another entry from rich text, e.g. a card for another post.

- `tools.reference()`: a button that picks a published entry and inserts `{ type: name, attrs: { collection, slug } }`.
- `referenceNode({ name })`: a ready-made node for it.
- Editor shows a card with the entry's title. Double-click to pick another.

```tsx filename="src/mnml-editor.tsx"
import { defineEditor, referenceNode, tools } from '@n3wtou/mnml-cms/editor';

export const editor = defineEditor({
  extensions: [referenceNode({ name: 'blockLink' })],
  tools: [tools.reference({ name: 'blockLink', label: 'Link a post', icon: <FileSymlinkIcon />, collection: 'posts', group: 'insert' })],
});
```

## On your site

The node stores only the slug: your site loads the entries. `collectReferences(doc)` returns every link in the doc as `{ collection, slugs }[]`, repeats removed. Load them in one go, then render with a component:

```tsx
import { collectReferences, RichText } from '@n3wtou/mnml-cms/rich-text';

const slugs = collectReferences(post.content, ['blockLink']).find((r) => r.collection === 'posts')?.slugs ?? [];
const linked = new Map((await cms.getEntries('posts', slugs)).map((p) => [p.slug, p.entry]));

<RichText
  content={post.content}
  editor={editor}
  components={{ blockLink: ({ attrs }) => <PostCard slug={String(attrs.slug)} post={linked.get(String(attrs.slug))} /> }}
/>;
```

- A linked entry can disappear later (unpublished, deleted). Handle a missing one; the example renders nothing.
- Node forms (`tools.node`) can use a `reference` field too. It offers published entries.
