---
'@n3wtou/mnml-cms': minor
---

New `blocks` field for pages built from different kinds of sections: `fields.blocks('Sections', { hero: block('Hero', { … }), … })`. Each section is one of the blocks, with its own fields in the admin and a `kind` to narrow on when rendering. Stored items are `{ kind, …fields }`; items whose kind is not in the config are dropped on read.
