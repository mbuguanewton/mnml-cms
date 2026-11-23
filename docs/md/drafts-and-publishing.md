---
title: "Drafts and publishing"
description: "Drafts, autosave, Publish, Discard changes and Unpublish, and what the site shows for each."
url: https://mnml-cms.vercel.app/drafts-and-publishing
---

# Drafts and publishing

A collection entry is draft or published. The admin's dot:

- **Green:** published
- **Grey:** draft
- **Orange over green:** published, with unpublished changes

## Collection list

- 25 entries a page, with Previous / Next.
- The search box filters by title or slug as you type (Enter without JavaScript).
- **Columns** chooses what the table shows. **Filters** narrows the list. **Column headers** sort it. **Checkboxes** select rows for bulk actions.
- Page, search, filters and sort live in the URL (`?q=…&status=draft&f.category=news&sort=f.date&dir=desc&page=2`), so links and the back button work.

### Filters

The Filters button opens a panel with one filter per field that can be filtered, in config order. Status (Draft, Changes, Published) is always first. A chip under the button shows each set filter, and **Clear filters** removes them all. Changing a filter starts again at page 1. Filters need JavaScript. The search box doesn't.

| Field | Filter |
| --- | --- |
| `select` | A dropdown of its options (with their labels). |
| `boolean` | Any, Yes or No. No also matches entries where it was never set. |
| `date`, `datetime` | From and to, both included. Entries without a date never match. A `datetime` is compared by its UTC day. |
| `number` | Min and max. Entries without a number never match. |
| `reference` | A dropdown of the target collection's published entries. |

Pick which filters show with `filters` on the collection. It takes field names, shown in that order. `filters: false` hides the whole control, status too.

```ts
posts: collection({
  label: 'Posts',
  titleField: 'title',
  basePath: '/blog',
  filters: ['category', 'featured', 'date'], // default: every filterable field
  fields: {
    title: fields.text('Title'),
    category: fields.select('Category', ['news', 'guide'] as const),
    featured: fields.boolean('Featured'),
    date: fields.date('Date'),
  },
});
```

A name that isn't a field, or is a field type that can't be filtered (`text`, `richtext`, `image`, `tags`, `references`, groups, blocks, arrays), throws when the config loads, and TypeScript flags a misspelt name.

### Columns and sorting

The table shows the title, Slug, Status and the first `date` field. Click a header to sort ascending, again for descending, a third time for the default order (newest `date` first). The header's arrow and `aria-sort` show the state.

- Text sorts without regard to case, numbers as numbers, dates as dates.
- A `select` sorts by its label, a `reference` by the target's title, a `boolean` with No first, Status as Draft, Changes, Published.
- Empty values come last in both directions. Equal values keep their order.

`columns` on the collection chooses the field columns, in order. The first is the link to the entry, then come Slug and Status, then the rest. Every column sorts. Shown: `text`, `url`, `date`, `datetime`, `number`, `boolean`, `select` and `reference`.

```ts
columns: ['title', 'category', 'date', 'featured'],
```

### Choosing columns

The **Columns** button opens a menu with a check mark beside each column: Slug, Status and every field that can be shown. Tick one to show it, untick to hide it; the menu stays open while you do. The first column (the link to the entry) is always shown. **Reset to default** goes back to the collection's `columns` (or the standard table).

The choice is kept per collection in this browser, in a cookie named `mnml_cols_<collection>` (set on the admin path, for a year; the server reads it, so the table renders right at once). Nothing is stored in the database, and other editors and browsers keep their own. Columns show in the menu's order: the ones the table shows by default first, then the other fields in config order. A sort on a column you hide is dropped. Filters don't depend on the columns shown.

`columnChoices` on the collection limits what the menu offers, besides Slug and Status. It takes field names, or `false` for no Columns button (the table then always shows `columns` or the default). A name that isn't a field, or isn't one of the shown types, throws when the config loads.

```ts
columnChoices: ['category', 'date', 'featured'], // default: every field that can be a column
```

### Bulk actions

A checkbox on each row (and one in the header for the whole page) selects entries. A bar appears at the bottom with the actions that apply:

| Action | Does |
| --- | --- |
| **Publish** | Makes drafts, and entries with unpublished changes, live. Asks for nothing. |
| **Unpublish** | Takes live entries off the site; their content becomes a draft. Asks first. |
| **Delete** | Deletes the entries. Asks first, and says how many are published. |

A button is disabled when it would do nothing to the selection (Publish when everything is live). Each entry is handled like a single save: validated, and `revalidate` / `onChange` run for it. An entry that can't be published (a required field is empty) is reported and left alone; the rest still go through. Entries already in the target state are skipped. Up to 100 at a time. A new search, filter, sort or page starts with nothing selected.

#### Your own actions

`listActions` in `createCms` adds buttons to the bar for a collection. Each runs once per selected entry, on the server. It's a server option because `mnml.config.ts` is plain data.

```ts
export const cms = createCms(config, {
  // …
  listActions: {
    posts: [
      {
        name: 'refresh', // unique in the collection; not publish, unpublish or delete
        label: 'Refresh on site',
        // danger: true,                    // red button
        // confirm: 'Rebuilds each page.',  // asks first (the admin adds how many)
        run: ({ key, slug, entry }) => revalidatePath(`/posts/${slug}`), // entry: its latest data
      },
    ],
  },
});
```

Throw an error to mark that entry as failed; the message is shown. A site action applies to every selected entry, whatever its status.

## Autosave

Edits to an existing entry save ~1.5 s after typing stops ("Saving…", then "Saved"). No save button for drafts.

| Action | Does |
| --- | --- |
| **Publish** | Draft becomes live. |
| **Discard changes** (⋮) | Drops unpublished changes, back to live. |
| **Unpublish** (⋮) | Takes it off the site. Content becomes a draft. |

A new entry: **Create draft** stores it, **Publish** puts it live. Autosaves after that.

### Only valid data is saved

- Invalid or empty required field: header says "Not saved: \<field\>: \<problem\>".
- Unsaved edits live in the browser only. Leaving warns first.
- So Publish never fails on a stored draft.

### Someone else edited it

Changed since you opened it? Autosave stops and asks you to reload. Never overwrites.

## On your site

Public readers (`listEntries`, `getEntry`, `getEntries`, `listSlugs`) return published entries only. A draft is a 404.

Editors see their draft in live preview, and anywhere on the site while Draft Mode is on for that entry (until "Exit preview").

## Singletons

Live by default: Save publishes. `drafts: true` gives autosave, Publish and Discard changes.

```ts
settings: singleton({ label: 'Settings', drafts: true, fields: { /* … */ } }),
```
