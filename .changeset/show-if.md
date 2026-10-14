---
'@n3wtou/mnml-cms': minor
---

Conditional fields: `showIf` on any field shows it only while its sibling fields match, e.g. `fields.url('URL', { showIf: { type: 'link' } })`. Hidden fields are not validated and keep their stored value. A `showIf` that names a field that is not a sibling throws when the config loads.
