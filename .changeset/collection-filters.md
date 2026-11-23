---
'@n3wtou/mnml-cms': minor
---

Admin collection lists get filters and sortable columns. A Filters button opens a panel with a filter for each `select`, `boolean`, `date`, `datetime`, `number` and `reference` field, plus Status (Draft, Changes, Published); set filters show as chips and combine with search and paging. Click a column header to sort (ascending, descending, default); empty values go last. State is in the URL (`?status=…&f.category=news&sort=f.date&dir=desc`). New `filters` option on `collection()` picks the filters (field names, in order; `false` hides the control) and new `columns` picks the field columns (the first links to the entry, then Slug and Status). A name that isn't a field, or can't be filtered or shown, throws when the config loads. Not breaking: without the options the table is as before and every filterable field gets a filter. Filters need JavaScript.
