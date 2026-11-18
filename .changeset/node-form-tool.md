---
'@n3wtou/mnml-cms': minor
---

Editor tools can ask for values in a form. `tools.node({ name, label, icon, group, fields, preview })` adds a button that opens a form in the admin's dialog (built from mnml fields and validated like an entry), then inserts the node; in the editor the node shows as a card that double-click edits. `nodeAttributes(fields)` gives the node's extension one attribute per field. A tool's `run` now also gets `{ form, confirm, alert }` as its second argument; existing `run(editor)` tools keep working.
