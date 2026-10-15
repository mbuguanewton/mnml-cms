---
'@n3wtou/mnml-cms': minor
---

Drafts autosave, like Sanity. Edits to an existing collection entry are saved as its draft about 1.5 seconds after you stop typing, and the live version only changes on **Publish**. The "Save draft" button is gone; **Discard changes** (in the "⋮" menu) goes back to the live version. A new entry is stored with **Create draft** (or published straight away) and autosaves from then on.

- Autosave only stores valid data: while a field is invalid or a required one is empty, the header says what is wrong and nothing is saved (leaving the page warns first). Publish never fails on a stored draft.
- If the entry was changed somewhere else since the form opened, autosave stops and asks for a reload instead of overwriting.
- Live preview follows autosave and no longer writes its own copy of every change.
- New `drafts: true` option on `singleton()` gives a singleton the same autosave, Publish and Discard changes. Off by default: a singleton's Save still publishes straight away.
- No database change. Existing saved-but-unpublished changes are the draft.
- The preview banner now reads "unpublished changes are shown".
