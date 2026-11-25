---
title: "Tables"
description: "Tables in rich text with @n3wtou/mnml-cms/table."
url: https://mnml-cms.vercel.app/editor/tables
---

# Tables

Own entry point, so sites without tables skip the code. Spread its extensions and tools into the editor config:

```tsx filename="src/mnml/editor.tsx"
import { defineEditor } from '@n3wtou/mnml-cms/editor';
import { tables } from '@n3wtou/mnml-cms/table';

export const editor = defineEditor({
  extensions: [...tables.extensions],
  tools: [...tables.tools],
});
```

## In the editor

- **Insert table**: 3×3 with a header row. Before your own insert buttons.
- Cursor in a table: a mini toolbar above its right end. Add/delete row or column (at the cursor's cell), toggle header row, delete table. Hides when the cursor leaves.

## On your site

`<RichText editor={editor}>` renders a plain `<table>` (`<th>`, `<td>`, no widths). Style it with your prose.

## Your own floating tools

Give a tool `context: 'callout'`: it shows in the same mini toolbar above the nearest `callout` node while the cursor is inside.
