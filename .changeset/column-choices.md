---
'@n3wtou/mnml-cms': minor
---

Editors choose which columns the collection list shows. A Columns button opens a menu with a check mark for Slug, Status and every field that can be a column (`text`, `url`, `date`, `datetime`, `number`, `boolean`, `select`, `reference`); the first column always shows, the menu stays open while you tick, and Reset to default goes back. The choice is kept per collection in a cookie, `mnml_cols_<collection>` (set on the admin path for a year, only when an editor changes columns), and the server renders it. New `columnChoices` option on `collection()` limits the menu to the field names you list, or `false` hides the button. `MenuAction` gets an optional `keepOpen` for on/off items. Not breaking: without a choice, the table is as before.
