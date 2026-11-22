# mnml-cms repo

Guidance for working on the package itself. How the CMS works is in `docs/content/` (also served as Markdown: `<page>.md` on the docs site).

This repo is a pnpm monorepo: `packages/cms` is the package (`@n3wtou/mnml-cms`) and `example/` is a Next.js site
that consumes it through `workspace:*`. 

- **Version and docs:** the source of truth is `packages/cms/package.json`, `packages/cms/CHANGELOG.md`,
  `docs/content/` (the docs site), `packages/cms/README.md` and `packages/cms/src/define.ts`, not `node_modules`. The change you are making is
  "the latest version".
- **Where things live:** config and field builders in `src/define.ts`; the API routes in `src/server/handlers.ts`
  (types in `src/api.ts`); `createCms` options in `src/server/context.ts`; storage in `src/server/store.ts`,
  `storage.ts` and `db.ts` (the entries table); the admin UI in `src/admin/`; public entry points in the
  `exports` of `packages/cms/package.json`.
- **The example is the test bed:** `example/mnml.config.ts`, `example/src/mnml.tsx`, `example/src/proxy.ts`,
  `example/src/app/admin/[[...path]]/page.tsx`, `example/src/app/api/mnml/[...route]/route.ts` and the pages in
  `example/src/app/(site)/`. Every feature should be used there so `pnpm --filter example build` exercises it.
  `pnpm build` rebuilds `packages/cms/dist` in place (no `rm -rf`; `scripts/prune-dist.mjs` drops stale files), so a running example dev server picks it up without a restart.
- **Example database scripts** (dev database only, via `example/.env.local`): `pnpm --filter example db:push`,
  `db:seed` (safe to rerun), `db:export`, `db:import`, `db:sync`.
- **Every user-facing change** updates the docs (`docs/content/`, a new page or a section; the README only changes
  for install and setup, or to link a new page) and adds a changeset (`pnpm changeset`: patch for
  fixes, minor for features, major for breaking changes, with upgrade steps in the changeset text). When a version
  ships, add its row and any upgrade steps to `docs/content/upgrading.mdx`.
- **Breaking for sites:** changes to the entries table (needs `drizzle-kit push`), stored data shapes, `apiPath`,
  cookie names, or `--mnml-*` CSS variables and `mnml-*` classes. Keep old stored data readable where possible.
- **Tooling:** Vite+ (`vite-plus`). Lint (Oxlint), format (Oxfmt), test (Vitest), the pre-commit staged checks and the
  `ci` task all live in the root `vite.config.ts`; there are no ESLint or Prettier configs. Hook scripts are in
  `.vite-hooks/` (pre-commit runs `vp staged`, pre-push runs `vp run ci`). Lint warnings fail CI (`--deny-warnings`). Tests sit next to the code as `src/**/*.test.ts` and
  import from `vite-plus/test`. Add tests for every change to `define.ts`, `sync.ts`, validation or readers.
- **Verify:** `pnpm exec vp run ci` (check, build, typecheck, test, example build; the same as GitHub CI and the
  pre-push hook), then the `playwright-check` skill for anything in
  the admin or on a page.
- Planned work lives in `TODO.md` (gitignored). Branches are `feat/<slug>` off `develop` (staging), merged by
  PR; `main` is the release branch and only takes PRs from `develop`.
- **Agent docs are generated.** `docs/content` is the only source. `packages/cms/scripts/build-agent-docs.mjs` writes each page as
  Markdown to `docs/md/<page>.md` (frontmatter: title, description, url; served at `<page>.md` by `docs/app/md`), `docs/public/llms*.txt`, and the MCP docs index
  (`packages/cms/src/server/docs-index.ts`). It runs in `pnpm build`; CI fails if they're stale. Every docs page needs a
  `description` in its frontmatter.
