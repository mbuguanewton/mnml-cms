---
'@n3wtou/mnml-cms': minor
---

MCP server for agents. Set `mcp: { tokens: [{ name, token, scopes, collections }] }` in `createCms` to serve it at `<apiPath>/mcp` (Streamable HTTP). Agents authenticate with a bearer token, separate from the admin login. Scopes are `read`, `draft` (the default with `read`), `publish` and `delete`, and a token can be limited to some collections. Tools: `get_schema`, `list_entries`, `get_entry`, `search`, `create_entry`, `update_entry`, `validate_entry`, `diff_entry`, `publish`, `unpublish`, `discard_draft`, `delete_entry`, `upload_media_from_url` and `get_preview_url`. Agent writes are drafts. They use the same validation and write path as the admin. `delete_entry` and `discard_draft` only make a request: the entry page in the admin shows it, and an editor approves or rejects it there. A discard is refused if the draft changed after the request. Like admin saves, everything except pending edits to a published entry runs `revalidate` and `onChange` (creating a draft, publishing, unpublishing, deleting), with `change.by` set to the token's name. `upload_media_from_url` only fetches public https hosts, checked again on every redirect.

Also new: `listEntries` returns `createdAt` and `updatedAt` for each entry. `<apiPath>/preview/open?key=&slug=` opens an entry's latest version in Draft Mode, for signed-in admins only.

Not breaking. No database change.
