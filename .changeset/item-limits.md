---
'@n3wtou/mnml-cms': minor
---

`array` and `blocks` take `min` and `max`, like `references`; `required` means at least one item. Saving outside the limits fails with an error on the field ("Add at least 1 item"), autosave pauses with the same reason, and the admin disables Add at `max` and says why. The `reference` and `references` pickers are now a search box (combobox) that filters published entries by title or slug, with keyboard and mouse picking; a single `reference` shows the picked entry with a clear button.
