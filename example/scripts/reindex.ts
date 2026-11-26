// Rebuilds the search index from the published content: run it after importing or syncing content, after turning
// `search` on for a site that already has content, or after changing the embedding model.
//   pnpm db:reindex
import { existsSync } from 'node:fs';
import { createSearch, drizzleStorage, neonDatabase } from '@n3wtou/mnml-cms/sync';
import config from '../mnml.config';
import { postgresSearch } from '../src/mnml/postgres-search';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// The same storage and index as createCms.
const url = process.env.DATABASE_URL;
const { entries, chunks, failed } = await createSearch(config, { storage: drizzleStorage(neonDatabase(url)), index: postgresSearch(url) }).reindex();
console.log(`Indexed ${entries} entries (${chunks} chunks).`);
for (const f of failed) console.error(`Failed: ${f.key}/${f.slug ?? '-'}: ${f.message}`);
if (failed.length) process.exitCode = 1;
