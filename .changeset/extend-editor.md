---
'@n3wtou/mnml-cms': minor
---

Extend the rich-text editor with your own Tiptap extensions and toolbar buttons.

- New entry `@n3wtou/mnml-cms/editor` with `defineEditor({ extensions, tools })` and ready-made `tools.underline`, `tools.strike` and `tools.horizontalRule`. `extensions` is added to the defaults, or a function that gets the defaults and returns the full list.
- `editorProvider(config)` from `@n3wtou/mnml-cms/admin` makes the client component to pass as the new `editor` option of `createCms`.
- `<RichText>` takes an `editor` prop so the site renders with the same extensions.
- The toolbar is grouped (history, text style, formatting, blocks, inserts; tools take an optional `group`), and its heading and quote buttons are now one text-style menu (Paragraph, Heading 1–4, Quote). Headings now go from level 1 to 4 (was 2 and 3); add styles for `h1` and `h4` to your site's rich-text CSS.
