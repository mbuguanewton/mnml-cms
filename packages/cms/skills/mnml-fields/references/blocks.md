<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# Blocks

`blocks`: a page of different kinds of sections, each kind with its own fields.

```ts
sections: fields.blocks('Sections', {
  hero: block('Hero', { title: fields.text('Title'), image: fields.image('Image') }),
  posts: block('Posts', { count: fields.number('How many') }),
  divider: block('Divider', {}),
}),
```

## In the admin

- "Add section" opens the block list (search box above eight blocks).
- Editors see only the picked block's fields.
- `block(label, fields, { description })`: one-line hint in the list.
- `fields.blocks(…, { addLabel })`: renames the button.

## Reading

Each item stores its block key as `kind`. Check it to narrow the type: after `section.kind === 'hero'`, `section.image` is typed.

- `kind` is reserved: no block field may be named `kind`.
- A `kind` no longer in the config is dropped on read, and gone from the entry on its next save.
