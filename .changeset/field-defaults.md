---
'@n3wtou/mnml-cms': minor
---

Fields can have a `default`: a value, or a function that returns one, type-checked against the field (a `select` default must be one of its options). New entries, never-saved singletons, new array items and new blocks start with their fields' defaults; reading existing entries never applies them. A function default runs when the entry form opens. New `initialValues(fields)` returns the values something starts with.
