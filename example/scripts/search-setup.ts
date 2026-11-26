// Creates the search tables (see search.sql, and search-vectors.sql with --vectors). Safe to run twice.
//   pnpm db:search [--vectors]
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const sql = neon(process.env.DATABASE_URL!);
for (const file of ['search.sql', ...(process.argv.includes('--vectors') ? ['search-vectors.sql'] : [])]) {
  for (const statement of readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').split(/;\s*\n/)) {
    if (statement.trim()) await sql.query(statement);
  }
  console.log(`Ran ${file}.`);
}
