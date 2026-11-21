---
title: "Field types"
description: "Every field type in mnml.config.ts, its options and the value readers return."
url: https://mnml-cms.vercel.app/fields
---

# Field types

Every field takes `{ required, help }`.

| Field | Value |
| --- | --- |
| `text`, `textarea` | `string` |
| `date` (`YYYY-MM-DD`), `url` | `string \| null` |
| `datetime` | `string \| null`, UTC (`2026-11-18T14:30:00.000Z`). Edited in local time. |
| `number(label, { min, max, step })` | `number \| null` |
| `boolean` | `boolean`, default `false` |
| `select(label, ['a', 'b'] as const)` | `'a' \| 'b' \| null`. Options can have [labels](https://mnml-cms.vercel.app/fields/select-labels.md). |
| `reference(label, 'authors')` | `string \| null`: a published entry's slug. Read with `cms.getEntry`. |
| `references(label, 'posts', { min, max })` | `string[]`: published slugs, in order. Read with `cms.getEntries`. |
| `image` | `{ url, alt, focalX?, focalY? } \| null`. [Focal point](https://mnml-cms.vercel.app/fields/focal-point.md) optional. |
| `richtext` | Tiptap JSON. Render with `<RichText>`. |
| `tags` | `string[]` |
| `array(label, fields, { itemLabel, min, max })` | Repeatable list of `fields` |
| `group(label, fields)` | Nested object, one form section: `page.hero.headline` |
| `blocks(label, { hero: block('Hero', fields), … }, { itemLabel, min, max })` | Sections of different [blocks](https://mnml-cms.vercel.app/fields/blocks.md): `{ kind: 'hero', …fields }[]` |
| `seo(label?)` | `group` of `title`, `description`, `image` ([SEO](https://mnml-cms.vercel.app/fields/seo.md)) |

## Picking entries

`reference` and `references` use a search box: filter by title or slug, pick with ↓/↑ + Enter or a click.

- `reference`: shows the pick, with a clear (×) button.
- `references`: shows the picks. Reorder, remove, add up to `max`.

```ts
related: fields.references('Related posts', 'posts', { max: 3 }),
authors: fields.references('Authors', 'authors', { required: true }),
```

`references` validation:

- Slugs trimmed. Blanks and repeats dropped.
- Then `min` / `max`. `required` = at least one.
- An entry unpublished later stays, marked "(unavailable)". Readers skip it.

## Groups become tabs

Groups add tabs above the form: **All fields**, **General** (fields outside groups), one per group.

A page with fixed sections: one singleton, a group per section. Editors add pages: a collection.
