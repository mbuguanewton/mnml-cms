---
'@n3wtou/mnml-cms': minor
---

Move content between databases (dev to prod and back). New entry `@n3wtou/mnml-cms/sync` with `exportContent`, `planImport`, `applyImport`, `describePlan` and `missingMedia`, which work on any `EntryStorage` and need no Next.js, so they run from a plain script. The example has `pnpm db:export`, `db:import` and `db:sync`.

- Modes: `add` (only what the target lacks), `overwrite`, `replace` (make the target match, deleting the rest).
- `--from-env-file`, `--to-env-file` and `--env-file` read the database URL from an env file (e.g. `.env.production`) instead of a variable, so dev and prod can each have their own `DATABASE_URL`.
- Dry run unless `--apply`; a non-local database also needs `--yes`; the target is backed up to `.mnml-backups/` first; entries are validated against the config and nothing is written if any don't fit.
- Moves the config's collections and their autosaved drafts. Not sign-in state, preview copies or uploaded files: files the content uses that the target doesn't have are listed.
