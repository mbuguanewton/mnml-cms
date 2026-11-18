---
'@n3wtou/mnml-cms': minor
---

New `fields.references(label, collection, { min, max })`: an ordered list of entry slugs, with a picker in the admin to add, reorder and remove entries (Add is disabled at `max`). Validation drops blanks and repeats and checks `min` / `max`; `required` means at least one. New `cms.getEntries(collection, slugs)` reads several published entries in one query, in the order given. Custom `EntryStorage` adapters can add an optional `readRowsBySlug(collection, slugs)`; without it, `getEntries` falls back to `readRows`.
