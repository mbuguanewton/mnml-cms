---
title: "Options"
description: "Every option of createCms: storage, auth, media, paths, sidebar, editor, ui, MCP, revalidate and onChange."
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
| `ui` | Component from `uiProvider()`: your own Button, Select… in the admin ([Custom admin UI](https://mnml-cms.vercel.app/custom-admin-ui.md)) |
| `mcp` | `{ tokens, adminTokens }`: MCP server for AI agents at `<apiPath>/mcp`, with tokens from env and/or the admin ([Agents](https://mnml-cms.vercel.app/agents.md)) |
| `revalidate` | After each save or delete, with `{ type, key, slug, by? }`. `by`: the agent token's name. |
| `onChange` | After the response (via `after()`) on each save or delete, e.g. to update a search index. Same change as `revalidate`. |

## In your own code

- `cms.isAdmin()`: checks the session in your routes. Works with the built-in login and adapters.
- `useAdmin()` from `@n3wtou/mnml-cms/admin` opens the admin's dialogs and toasts in custom admin pages:

```ts
const { confirm, alert, toast } = useAdmin();
await confirm({ title: 'Delete?', description: '…', confirmLabel: 'Delete', danger: true }); // true or false
toast({ title: 'Saved', tone: 'success' }); // tone: 'info' | 'success' | 'danger'; duration in ms, 0 = stays
```

## Admin UI components

Build `pages` with the admin's own controls from `@n3wtou/mnml-cms/admin`. To use your own instead, see [Custom admin UI](https://mnml-cms.vercel.app/custom-admin-ui.md). Client components. No extra dependencies. Styled with `--mnml-*`.

| Component | Props |
| --- | --- |
| `Button` | `variant`, `size`, `disabled`, `onClick`, `children` |
| `Input`, `Textarea` | `id`, `value`, `onChange(value)`, `placeholder`, `disabled`, `invalid`. `Input` also `type` (number, date, datetime-local stay native, restyled). |
| `Select` | `id`, `value` (string or null), `onChange(value)`, `options: { value, label }[]`, `placeholder`, `clearable`, `invalid` |
| `Checkbox`, `Switch` | `id`, `checked`, `onChange(checked)`, `disabled`, `label` |
| `DatePicker` | `id`, `value` (`YYYY-MM-DD` or null), `onChange(value)`, `time` (adds a time box; value `YYYY-MM-DDTHH:mm`), `timeInCalendar` (with `time`: one box, time row in the calendar), `invalid` |
| `Tooltip` | `content`, `side`, one focusable child. Shows on hover and keyboard focus. |
| `Menu` | `label`, `items: { id, label, icon, checked, disabled, danger, onSelect }[]`, `trigger`, `className` |

- `onChange` gets the value, not the event.
- `Select`: full width; cap it with a `max-w-*` class. Arrows, Home/End, type-ahead, Enter, Escape. A value that isn't an option shows as "(unavailable)".
- `Menu`: a "more" icon button by default; pass `trigger` for your own content. Set `checked` for on/off items. Arrows wrap, Home/End, type-ahead, Escape.
- Label a control with `<label htmlFor={id}>`, the `label` prop, or `aria-label`.
- Prop types are exported: `SelectProps`, `CheckboxProps`, `MenuProps`, `MenuAction`, `ToastOptions`, …

```tsx
'use client';
import { Select, Switch, useAdmin } from '@n3wtou/mnml-cms/admin';

const { toast } = useAdmin();
<Select id="section" value={section} onChange={setSection} options={[{ value: 'posts', label: 'Posts' }]} />
<Switch checked={on} onChange={setOn} label="Confirm first" />
```
