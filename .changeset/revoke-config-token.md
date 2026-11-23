---
'@n3wtou/mnml-cms': patch
---

Agent access: tokens from `mcp.tokens` ("from config") now show a Revoke button. They live in your config, so it opens a dialog saying to remove the token from the config or its environment variable and redeploy; it keeps working until then. Tokens created in the admin revoke as before.
