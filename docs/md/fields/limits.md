---
title: "Limits"
description: "min and max on array, blocks and references fields."
url: https://mnml-cms.vercel.app/fields/limits
---

# Limits

`array`, `blocks`, `references` take `min` / `max` item counts.

```ts
links: fields.array('Links', { label: fields.text('Label'), url: fields.url('URL') }, { max: 4 }),
sections: fields.blocks('Sections', { hero, text }, { min: 1 }),
```

- `required` = at least one.
- Out of range: save fails with a field error ("Add at least 1 item"); autosave pauses.
- At `max`, Add is disabled with a reason.
- Fields hidden by `showIf` aren't checked.
