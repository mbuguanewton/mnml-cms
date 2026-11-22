---
title: "Agents (MCP)"
description: "Let AI agents (Claude Code, Cursor, Zed) manage content through the built-in MCP server, with scoped tokens, drafts and editor approval."
url: https://mnml-cms.vercel.app/agents
---

# Agents (MCP)

Let AI agents (Claude Code, Cursor, Zed) edit your content. The CMS has a built-in MCP server. Agents use the same checks as the admin.

- Agents write drafts. Nothing goes live until `publish`.
- Agents can't delete or discard alone. An editor approves in the admin.
- Each agent has its own token. The token's scopes decide what it can do.

## Set up

1. Make a token (32+ random characters):

   ```sh
   openssl rand -hex 32
   ```

2. Put it in your env: `.env.local` locally, your host's settings in production.

   ```sh
   MNML_AGENT_TOKEN=…
   ```

3. Turn on the server:

   ```ts
   export const cms = createCms(config, {
     // …
     mcp: {
       tokens: [{ name: 'claude', token: process.env.MNML_AGENT_TOKEN, scopes: ['read', 'draft'] }],
     },
   });
   ```

Done. The server lives at `<apiPath>/mcp`, e.g. `https://your-site.com/api/mnml/mcp`. Your route file (`export const { GET, POST } = cms.handlers`) already serves it.

- No token set (and no `adminTokens`): the route is off (404).
- Token under 32 characters: ignored, with a warning in the log.

## Tokens

The agent sends `Authorization: Bearer <token>`. It must match the value in your site's env exactly.

| Option | What it does |
| --- | --- |
| `token` | The secret, e.g. `process.env.MNML_AGENT_TOKEN`. Unset: ignored. |
| `name` | Shown as `change.by` in `onChange`, and on approval requests. Default `'agent'`. |
| `scopes` | What the token can do. Default `['read', 'draft']`. |
| `collections` | Only these keys, e.g. `['posts']`. Default: all. |

One token per agent or person. Then each has its own scopes and name, and you can revoke one alone. To rotate, change the value on the site and in the agent.

```ts
mcp: {
  tokens: [
    { name: 'newton', token: process.env.MNML_TOKEN_NEWTON, scopes: ['read', 'draft', 'publish'] },
    { name: 'blog-bot', token: process.env.MNML_TOKEN_BOT, collections: ['posts'] },
  ],
},
```

### Tokens from the admin

Let editors make tokens in the admin instead of env vars:

```ts
mcp: { adminTokens: true },
```

- **Agent access** appears in the sidebar (under Tools).
- Create: name, scopes (default `read` + `draft`), content (default all). The token (`mnml_…`) shows **once**, with a ready `claude mcp add` command. Copy it then.
- Stored as a SHA-256 hash in the entries table. No migration.
- The list shows each token's scopes, content, created and last used (updated at most once a minute).
- **Revoke** cuts access on the agent's next request.
- Config tokens still work alongside, and show in the list as "from config". Names are unique across both.

### Scopes

| Scope | Can | Tools |
| --- | --- | --- |
| `read` | Read schema and entries, drafts too | `get_schema`, `list_entries`, `get_entry`, `search`, `validate_entry`, `diff_entry`, `get_preview_url` |
| `draft` | Create entries, save drafts, import images | `create_entry`, `update_entry`, `upload_media_from_url` |
| `publish` | Go live, go offline, ask to discard | `publish`, `unpublish`, `discard_draft` |
| `delete` | Ask to delete | `delete_entry` |

- Scopes don't include each other. List each one you want.
- Agents only see tools they have scopes for. Others fail with the missing scope's name.
- A singleton without `drafts: true` has no draft: saving it goes live. So `update_entry` on it needs `publish` too.

## Tools

| Tool | What it does |
| --- | --- |
| `get_schema` | All content the token can use. Each field as JSON Schema: type, required, options, limits. Call first. |
| `list_entries` | A collection's entries: `status`, `createdAt`, `updatedAt`, `hasDraftChanges`. Filter, sort, page. |
| `get_entry` | One entry, latest version, drafts included. Shows a waiting approval request. Rich text as JSON or Markdown. |
| `search` | Find text in entries, rich text too. |
| `validate_entry` | Check data, save nothing. Returns errors per field. |
| `diff_entry` | Fields where the draft differs from live. |
| `get_preview_url` | Link to see the draft on your site. Editors only. |
| `create_entry` | New collection entry, as a draft. Slug comes from the title unless given. Missing fields get their default. |
| `update_entry` | Change some fields. The rest stay. |
| `upload_media_from_url` | Copy an https image (4 MB max) into your storage. Returns a value for an `image` field. |
| `publish` | Make the latest version live. |
| `unpublish` | Take an entry off the site. It becomes a draft. |
| `discard_draft` | Ask to throw away unpublished changes. |
| `delete_entry` | Ask to delete an entry. |

- Bad data returns errors per field, same checks as the admin.
- Unknown field names fail. They are never dropped silently.

### Rich text

Agents write rich text as Markdown. The server turns it into Tiptap JSON.

```json
{ "title": "Hello", "content": "## Intro\n\nSome **bold** text and a [link](https://x.com).\n\n- one\n- two" }
```

- Works: headings, **bold**, *italic*, ~~strike~~, `code`, links, lists, quotes, code blocks, images, `---`.
- Tables and raw HTML: refused with a field error. Send Tiptap JSON (`{ "type": "doc", "content": [...] }`) for those.
- References and your own editor nodes: Tiptap JSON only.
- Works in nested fields too (groups, arrays, blocks).

To read rich text as Markdown, pass `richText: 'markdown'` to `get_entry` or `list_entries`. It's shorter than JSON. Nodes Markdown can't show come out as `<!-- mnml:<type> -->`, and the result has `lossy: true`. Don't write that Markdown back, or those nodes are lost.

## Drafts

Same rules as [Drafts and publishing](https://mnml-cms.vercel.app/drafts-and-publishing.md):

- `create_entry`: a draft. 404 on the site.
- `update_entry` on a published entry: live version stays. The edit waits beside it (orange dot in the admin).
- `publish`: live, and the site revalidates.

`get_preview_url` gives `<apiPath>/preview/open?key=…&slug=…`. It opens the page in Draft Mode, only for editors signed in to the admin. Everyone else goes to login.

## Approval

`delete_entry` and `discard_draft` change nothing. They create a request and return `status: 'awaiting_approval'` plus `approveUrl` (the entry's admin page).

- The list shows **Awaiting approval**.
- The entry page shows the request with **Reject** and **Approve**.
- Discard is refused if the draft changed after the request.
- One request per entry. A new one replaces the old.
- Publishing the draft drops a discard request.

`get_entry` returns a waiting request as `awaitingApproval`.

## Connect an agent

Locally, use `http://localhost:3000/api/mnml/mcp`. The header must be `Authorization`, value `Bearer <token>`.

### Claude Code

```sh
claude mcp add --transport http mnml https://your-site.com/api/mnml/mcp --header "Authorization: Bearer $MNML_AGENT_TOKEN"
```

Or commit `.mcp.json` so your whole team gets it. The token comes from each person's env, never from git:

```json
{
  "mcpServers": {
    "mnml": {
      "type": "http",
      "url": "https://your-site.com/api/mnml/mcp",
      "headers": { "Authorization": "Bearer ${MNML_AGENT_TOKEN}" }
    }
  }
}
```

### Zed

In `settings.json`:

```json
"context_servers": {
  "mnml": {
    "url": "https://your-site.com/api/mnml/mcp",
    "headers": { "Authorization": "Bearer <token>" }
  }
}
```

### Cursor

In `~/.cursor/mcp.json`. It holds the token, so keep it out of git.

```json
{
  "mcpServers": {
    "mnml": {
      "url": "https://your-site.com/api/mnml/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### Claude connectors

Not yet. Connectors in claude.ai and the Claude apps need OAuth, and the server doesn't support it yet. Use a client that can send a header.

## Security

- Tokens live in env vars. Never commit them.
- Give the fewest scopes. `['read', 'draft']` can't change the live site.
- Limit with `collections` when you can.
- `upload_media_from_url` only fetches public https hosts. Private, loopback and link-local addresses are refused, on every redirect too.
- Browser requests from other sites are refused, same as the admin.
