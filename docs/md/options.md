---
title: "Options"
description: "Every option of createCms: storage, auth, media, paths, sidebar, editor, MCP, revalidate and onChange."
url: https://mnml-cms.vercel.app/options
---

# Options

Second argument of `createCms(config, options)`.

| Option | Purpose |
| --- | --- |
| `database` | Drizzle Postgres database, or a function returning one (called on first use) |
| `table` | Table name, with `database`. Default `entries`. |
| `storage` | Your own `EntryStorage` instead of `database` ([Other ORMs](https://mnml-cms.vercel.app/other-orms.md)) |
| `auth` | `{ password, secret }` for the built-in login, or an `AuthAdapter` ([Authentication](https://mnml-cms.vercel.app/authentication.md)) |
| `media` | Image storage ([Image storage](https://mnml-cms.vercel.app/image-storage.md)) |
| `adminPath`, `apiPath` | Default `/admin`, `/api/mnml`. Must match the route files. |
| `brand` | Sidebar title: string or (async) function |
| `icons` | Sidebar icons per key, e.g. `{ posts: <FileTextIcon /> }` |
| `pages` | Extra admin screens: `{ path, label, group?, icon?, render }`. Build with `@n3wtou/mnml-cms/admin`. |
| `editor` | Component from `editorProvider()`: extra extensions and buttons ([Extending the editor](https://mnml-cms.vercel.app/editor.md)) |
| `mcp` | `{ tokens }`: MCP server for AI agents at `<apiPath>/mcp` ([Agents](https://mnml-cms.vercel.app/agents.md)) |
| `revalidate` | After each save or delete, with `{ type, key, slug, by? }`. `by`: the agent token's name. |
| `onChange` | After the response (via `after()`) on each save or delete, e.g. to update a search index. Same change as `revalidate`. |

## In your own code

- `cms.isAdmin()`: checks the session in your routes. Works with the built-in login and adapters.
- `useAdmin()` from `@n3wtou/mnml-cms/admin` opens the admin's dialogs in custom admin pages:

```ts
const { confirm, alert } = useAdmin();
await confirm({ title: 'Delete?', description: '…', confirmLabel: 'Delete', danger: true }); // true or false
```
