---
title: "Dates and times"
description: "The date and datetime fields: storage, time zones and sorting."
url: https://mnml-cms.vercel.app/fields/dates-and-times
---

# Dates and times

| Field | Stores |
| --- | --- |
| `date` | A day (`YYYY-MM-DD`), no time zone |
| `datetime` | A moment in UTC, one format: `2026-11-18T14:30:00.000Z` |

`datetime`:

- One format, so `listEntries({ orderBy })` sorts by time.
- Admin edits it in the editor's time zone, named under the input.
- API values need `Z` or an offset (`2026-11-18T17:30+03:00`). Converted to UTC.
- `showIf` can test a value or `{ empty: true }`. `gt`, `lt`… are numbers only.

On your site, pick the display time zone. The server's is usually UTC.

```ts
new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(post.publishedAt));
```
