<!-- Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file. -->

# Select labels

An option is a value, or a value with a label (shown in the admin). Mix freely.

```ts
category: fields.select('Category', ['news', { value: 'guide', label: 'How-to guide' }] as const), // 'news' | 'guide' | null
```

- Types come from the values.
- Entries, `default`, `showIf`, validation: values, not labels.
- A repeated value throws at config load.

Label on your site: `selectLabel` with the field from your config:

```ts
selectLabel(config.posts.fields.category, post.category);
```
