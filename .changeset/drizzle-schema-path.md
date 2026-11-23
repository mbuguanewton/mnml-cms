---
'@n3wtou/mnml-cms': patch
---

Docs: the Drizzle schema path in the README, getting started and upgrading now matches 1.6.0. The file moved from `dist/server/db.js` to `dist/server/content/db.js`, so `drizzle.config.ts` needs `schema: './node_modules/@n3wtou/mnml-cms/dist/server/content/db.js'` after upgrading to 1.6.0 (`drizzle-kit push` fails with the old path). `AGENTS.md` and the upgrading checks point at the current `dist/` paths.
