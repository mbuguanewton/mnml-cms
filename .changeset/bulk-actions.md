---
'@n3wtou/mnml-cms': minor
---

Select rows in a collection's list and act on many entries at once. A checkbox on each row (and one in the header for the page) opens a bar with Publish, Unpublish and Delete; a button is disabled when it would do nothing. Unpublish and Delete ask first, saying how many are published. Each entry is saved like a single one (validated, `revalidate` / `onChange` run); one that can't be published is reported and the rest go through. New `listActions` option on `createCms` adds your own buttons per collection: `{ posts: [{ name, label, danger?, confirm?, run({ key, slug, entry }) }] }`. New admin route `bulk` (up to 100 entries). Not breaking.
