---
title: "Reading content"
description: "Read content on your pages: getSingleton, listEntries, getEntry, getEntries, listSlugs, RichText and live preview."
url: https://mnml-cms.vercel.app/reading-content
---

# Reading content

```tsx
import { cms } from '@/mnml';
import { RichText } from '@n3wtou/mnml-cms/rich-text';

const settings = await cms.getSingleton('settings');
const posts = await cms.listEntries('posts'); // [{ slug, entry, status, createdAt, updatedAt }]
const latest = await cms.listEntries('posts', { orderBy: 'date', order: 'desc', limit: 3 });
const post = await cms.getEntry('posts', slug);
const related = await cms.getEntries('posts', post.related); // [{ slug, entry }]
export const generateStaticParams = async () => (await cms.listSlugs('posts')).map((slug) => ({ slug }));

<RichText content={post.content} className="prose" />
```

Every result is typed from your config.

## A list page and a post page

```tsx
// app/(site)/blog/page.tsx
const posts = await cms.listEntries('posts', { orderBy: 'date', order: 'desc', limit: 10 });
posts.map(({ slug, entry }) => <Link key={slug} href={`/blog/${slug}`}>{entry.title}</Link>);
```

```tsx
// app/(site)/blog/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { RichText } from '@n3wtou/mnml-cms/rich-text';
import { seoMetadata } from '@n3wtou/mnml-cms';
import { cms } from '@/mnml';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const post = await cms.getEntry('posts', (await params).slug);
  return post ? seoMetadata(post.seo, { title: post.title }) : {};
}

export default async function Page({ params }: Props) {
  const post = await cms.getEntry('posts', (await params).slug);
  if (!post) notFound();
  return (
    <article>
      <h1>{post.title}</h1>
      {post.cover && <img src={post.cover.url} alt={post.cover.alt} />}
      <RichText content={post.content} />
    </article>
  );
}
```

## Static rendering

Pages that read the CMS render static. Reads only touch `cookies()` and `headers()` in Draft Mode, so visitors get the cached page. Same for `<cms.PreviewBanner />`.

To go static:

- Don't set `export const dynamic = 'force-dynamic'`.
- Have `DATABASE_URL` at build time. No database at build? Keep `force-dynamic` on pages reading the CMS.
- Optional: prebuild dynamic routes. Without it a route renders on its first visit, then is cached.

```tsx
export const generateStaticParams = async () => (await cms.listSlugs('posts')).map((slug) => ({ slug }));
```

What to know:

- **Edits go live.** Each save or delete revalidates `'/'` (layout) by default. Publish refreshes the page and lists; unpublish gives a 404. Narrow it with the `revalidate` option.
- **Drafts preview fine** on static routes. Leave `dynamicParams` at its default: `listSlugs` returns published slugs only, so `dynamicParams = false` would 404 a draft.
- **Keep request APIs off public pages.** `cms.isAdmin()`, `cookies()`, `headers()` and `searchParams` make that page dynamic.
- `/admin` and the API route are always dynamic.

## Caching

Out of the box, a read is de-duplicated within one request only. Every request that reads content queries the database. Turn on `cache` (recommended) to keep published reads between requests:

```ts
createCms(config, { cache: true }); // or { revalidate: 600 }
```

- Covers `getSingleton`, `getEntry`, `getEntries`, `listEntries` and `listSlugs`. Each save, publish, unpublish or delete drops what was cached for that collection, so edits show at once.
- Your own `revalidate` option does not stop that. It only replaces the default `revalidatePath`.
- Draft Mode, `all: true` and the admin always read fresh data.
- `revalidate` (seconds, default 3600) is the longest a read lives. Content written outside the CMS (`db:import`, `sync`, SQL, another app) does not drop the cache, so it shows up after this time. Lower it if you write that way often.
- Next stores each cached value up to about 2 MB. A longer list is read from the database each time. Use `limit`, or `getEntries`, on huge collections.
- Built on Next's `unstable_cache`, which Next replaced with `use cache`. On an app with `cacheComponents` on, test it before relying on it.

## `listEntries` options

| Option | Value |
| --- | --- |
| `orderBy` | Field, derived value, `'slug'`, `'createdAt'`, `'updatedAt'`. Default `'slug'`. Empties last. |
| `order` | `'asc'` or `'desc'` |
| `filter` | `(entry) => boolean` |
| `limit`, `offset` | Numbers |

Items have `createdAt` / `updatedAt` (`Date`; `null` for a never-saved draft in preview).

## `getEntries`

`getEntries(collection, slugs)`: several entries, one query. For `references` fields. Published only, in `slugs` order. Skips missing, unpublished and repeated slugs.

## Live preview

Render `<cms.PreviewBanner />` in your site layout. Only previewing editors see it; pages stay static for everyone else.

Saving revalidates the whole site (`revalidatePath('/', 'layout')`). Change it with `revalidate`.
