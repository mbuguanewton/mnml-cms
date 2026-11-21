<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# SEO

`fields.seo()`: a group of `title`, `description`, `image`. `seoMetadata(entry.seo, fallback)` makes Next.js `Metadata`; empties use `fallback`.

```ts
export const generateMetadata = async () => seoMetadata((await cms.getSingleton('home'))?.seo, { title: 'Home' });
```
