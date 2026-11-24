---
'@n3wtou/mnml-cms': minor
---

Create a referenced entry without leaving the form. `reference` and `references` fields get a **Create new** button that opens a side panel with the target collection's form: Publish, or Save draft, then the new entry is picked. Panels can stack (a reference inside the panel has its own). Turn it off per field with `createNew: false`. New admin route `reference/schema`. Not breaking.
