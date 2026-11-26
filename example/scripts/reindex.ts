// Rebuilds the search index from the published content: run it after importing or syncing content, after turning
// `search` on for a site that already has content, or after changing the embedding model.
//   pnpm db:reindex
import { existsSync } from 'node:fs';
import { createSearch, neonDatabase } from '@n3wtou/mnml-cms/sync';
import config from '../mnml.config';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// Pass the same `search` options as createCms (here none: the built-in Postgres full-text index).
const { entries, chunks } = await createSearch(config, { database: neonDatabase(process.env.DATABASE_URL) }).reindex();
console.log(`Indexed ${entries} entries (${chunks} chunks).`);
