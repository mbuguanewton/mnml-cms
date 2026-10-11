import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'postgresql',
  schema: './node_modules/@newtou/mnml-cms/dist/server/db.js',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
