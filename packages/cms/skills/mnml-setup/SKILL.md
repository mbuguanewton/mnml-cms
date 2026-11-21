---
name: mnml-setup
description: "mnml createCms options, auth (password or AuthAdapter), image storage (Vercel Blob, local, custom), EntryStorage without Drizzle."
---

<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

> Matches the installed version. Online: https://mnml-cms.vercel.app/options

# Options

Second argument of `createCms(config, options)`.

| Option | Purpose |
| --- | --- |
| `database` | Drizzle Postgres database, or a function returning one (called on first use) |
| `table` | Table name, with `database`. Default `entries`. |
| `storage` | Your own `EntryStorage` instead of `database` ([Other ORMs](https://mnml-cms.vercel.app/other-orms)) |
| `auth` | `{ password, secret }` for the built-in login, or an `AuthAdapter` ([Authentication](https://mnml-cms.vercel.app/authentication)) |
| `media` | Image storage ([Image storage](https://mnml-cms.vercel.app/image-storage)) |
| `adminPath`, `apiPath` | Default `/admin`, `/api/mnml`. Must match the route files. |
| `brand` | Sidebar title: string or (async) function |
| `icons` | Sidebar icons per key, e.g. `{ posts: <FileTextIcon /> }` |
| `pages` | Extra admin screens: `{ path, label, group?, icon?, render }`. Build with `@n3wtou/mnml-cms/admin`. |
| `editor` | Component from `editorProvider()`: extra extensions and buttons ([Extending the editor](https://mnml-cms.vercel.app/editor)) |
| `mcp` | `{ tokens }`: MCP server for AI agents at `<apiPath>/mcp` ([Agents](https://mnml-cms.vercel.app/agents)) |
| `revalidate` | After each save or delete, with `{ type, key, slug, by? }`. `by`: the agent token's name. |
| `onChange` | After the response (via `after()`) on each save or delete, e.g. to update a search index. Same change as `revalidate`. |

## In your own code

- `cms.isAdmin()`: checks the session in your routes. Works with the built-in login and adapters.
- `useAdmin()` from `@n3wtou/mnml-cms/admin` opens the admin's dialogs in custom admin pages:

```ts
const { confirm, alert } = useAdmin();
await confirm({ title: 'Delete?', description: '…', confirmLabel: 'Delete', danger: true }); // true or false
```

## More

- [Authentication](references/authentication.md): The built-in password login, or your own auth (Better Auth, Auth.js, Clerk) through an AuthAdapter.
- [Image storage](references/image-storage.md): Where uploaded images are stored: local disk in development, Vercel Blob, or your own storage.
- [Other ORMs](references/other-orms.md): Store entries without Drizzle by writing your own EntryStorage (Prisma, Kysely, SQL).
