---
'@n3wtou/mnml-cms': minor
---

Agent tokens from the admin. `mcp: { adminTokens: true }` adds an "Agent access" page in `/admin` where editors create MCP tokens (name, scopes, content), see when each was last used, and revoke them. A new token (`mnml_…`) is shown once, with a ready `claude mcp add` command; only its SHA-256 hash is stored, in the entries table (no migration). A revoked token gets 401 on its next request. `mcp.tokens` from the config keep working alongside, and names are unique across both. `mcp.tokens` is now optional.
