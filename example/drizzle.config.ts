import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'postgresql',
  // The entries table, and the search index table (`search: true`).
  schema: ['./node_modules/@n3wtou/mnml-cms/dist/server/content/db.js', './node_modules/@n3wtou/mnml-cms/dist/server/search/table.js'],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
