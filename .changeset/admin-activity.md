---
'@n3wtou/mnml-cms': minor
---

Activity for each entry and singleton: a log of who saved, published, unpublished, discarded or deleted it, and when. Open **Activity** in the entry's **⋮** menu.

- Recorded on every write through the admin, bulk actions and the MCP server. Each event has the time, who (the editor, an agent by token name, or the assistant) and the fields that changed. A run of autosaves is one event.
- When the assistant runs tools or fills fields on an entry, its event shows the question, the tools it ran with their input, and each field before and after. It works without an assistant `store`.
- `actor: (request) => ({ label, id? })` on `createCms()` names the editor. Default "Admin".
- Kept as rows in the entries table under `activity:<key>`: no new table, no `drizzle-kit push`. The last 200 events of each entry are kept, and a failure to log never fails a write.
