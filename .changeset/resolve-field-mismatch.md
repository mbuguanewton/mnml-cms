---
'@n3wtou/mnml-cms': minor
---

Change a field while entries hold content, and the admin now asks instead of crashing or silently overwriting. A stored value that no longer fits its field (rich text to text, a removed `select` option, text to date or references) shows a card in place of the field: the old value, a suggested conversion where there is one (editable, checked as the field's kind of value, with a note on what it loses; **Use this**), and **Remove**, which drops it and brings back the normal empty field. A banner counts them, a row with a card opens by itself, and autosave and Publish wait until each is settled, so the old content is never overwritten by accident. Entries with a `date`, `references` or `image` holding the wrong kind of value used to crash the admin page (500); they open now. Save errors name the field's label.

Readers (`getEntry`, `getEntries`, `listEntries`, `getSingleton`) now return the field's empty value for a stored value that doesn't fit, instead of passing it through, and `next dev` logs a warning for each entry and field. Valid entries read as before; if your site relied on getting a wrongly typed stored value, it now gets the empty one. Stored data is not changed. New example script `pnpm --filter example db:mismatch` makes entries with stale values. See [Changing fields](https://mnml-cms.vercel.app/changing-fields).
