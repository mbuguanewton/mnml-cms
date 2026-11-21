---
'@n3wtou/mnml-cms': minor
---

Own admin UI components, no new dependencies. `Select` (a keyboard listbox in a popover) replaces the native select. `Checkbox` and `Switch` replace native checkboxes (boolean fields, login, Agent access). Number, date and datetime inputs keep the browser's pickers but look the same in every browser, light and dark. Toolbar `title=` hints are now tooltips that also show on keyboard focus. Save results show as toasts, also on phones. `@n3wtou/mnml-cms/admin` exports `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Tooltip` and their prop types, and `useAdmin()` adds `toast()`, for custom admin pages. Not breaking: `--mnml-*` variables are unchanged; the new `mnml-input` class sits on inputs.
