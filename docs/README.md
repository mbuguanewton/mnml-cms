# Docs

The documentation site for `@n3wtou/mnml-cms`, built with [Nextra](https://nextra.site) (docs theme) on Next.js.

```sh
pnpm --filter docs dev     # http://localhost:3000
pnpm --filter docs build   # also builds the search index (Pagefind) into public/_pagefind
```

Search only works after a build: `pnpm --filter docs build && pnpm --filter docs start`.

## Where things live

- `content/`: one `.mdx` page per topic. The URL is the file path (`content/fields/blocks.mdx` is `/fields/blocks`).
- `content/**/_meta.ts`: sidebar order and titles. Add new pages here.
- `app/layout.tsx`: navbar, footer, and the "Edit this page" link.

## When you add or change a feature

Document it here, not in `packages/cms/README.md`. The README only covers install and setup, and links to these
pages. A new feature gets its own page, or a section on the page it belongs to; link to it from the README's
"Documentation" list if it's a new page.

MDX treats `<` and `{` in prose as JSX: write them inside backticks, or escape them (`\<`).
