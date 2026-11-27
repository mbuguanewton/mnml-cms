// Creates the assistant's record table (see assistant.sql). Safe to run twice.
//   pnpm db:assistant
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const sql = neon(process.env.DATABASE_URL!);
for (const statement of readFileSync(new URL('./assistant.sql', import.meta.url), 'utf8').split(/;\s*\n/)) {
  if (statement.replace(/^\s*--.*$/gm, '').trim()) await sql.query(statement);
}
console.log('Ran assistant.sql.');
