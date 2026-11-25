---
'@n3wtou/mnml-cms': minor
---

New `cache` option: `createCms(config, { cache: true })` keeps published reads (`getSingleton`, `getEntry`, `getEntries`, `listEntries`, `listSlugs`) between requests. Each save, publish, unpublish or delete drops what was cached for that collection, even with your own `revalidate`. Draft Mode, `all: true` and the admin read fresh data. `{ revalidate }` sets the longest a read may live (default 3600 seconds), which matters for content written outside the CMS. Off by default; recommended. Built on `unstable_cache`; test it first if your app uses `cacheComponents`. See [Caching](https://mnml-cms.vercel.app/reading-content#caching).
