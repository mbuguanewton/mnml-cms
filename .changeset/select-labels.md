---
'@n3wtou/mnml-cms': minor
---

Select options can have labels: `fields.select('Category', ['news', { value: 'guide', label: 'How-to guide' }] as const)`. The admin shows the labels, entries store the values, and the value type is still inferred. New `selectLabel(field, value)` gives the label for showing a value on the site. A stored value that is no longer an option shows as "(unavailable)" in the admin.
