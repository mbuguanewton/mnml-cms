---
title: "SEO"
description: "The seo() field and seoMetadata() for Next.js metadata."
url: https://mnml-cms.vercel.app/fields/seo
---

# SEO

`fields.seo()`: a group of `title`, `description`, `image`. `seoMetadata(entry.seo, fallback)` makes Next.js `Metadata`; empties use `fallback`.

```ts
export const generateMetadata = async () => seoMetadata((await cms.getSingleton('home'))?.seo, { title: 'Home' });
```
