---
'@n3wtou/mnml-cms': minor
---

Rich text can link to other entries. `tools.reference({ name, label, icon, collection })` picks a published entry and inserts `{ type: name, attrs: { collection, slug } }`; `referenceNode({ name })` is a ready-made node for it, shown in the editor as a card with the entry's title. `collectReferences(doc)` lists the entries a document links to (`{ collection, slugs }[]`), for loading them before rendering. Node forms (`tools.node`) also accept `reference` fields. Adds an admin-only `references` API route that the pickers use.
