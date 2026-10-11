// Inserts a settings row and one post. Existing rows are left alone.
//   pnpm db:seed
import { existsSync } from 'node:fs';
import { entries, neonDatabase } from '@newtou/mnml-cms/db';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const db = neonDatabase(process.env.DATABASE_URL);

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const rows = [
  { collection: 'settings', slug: 'singleton', data: { name: 'Example', tagline: 'Built with mnml-cms' } },
  { collection: 'posts', slug: 'hello', data: { title: 'Hello', summary: 'A first post', date: '2026-01-01', content: { type: 'doc', content: [para('Hello, world.')] } } },
];

const res = await db().insert(entries).values(rows).onConflictDoNothing().returning({ slug: entries.slug });
console.log(`Inserted ${res.length} of ${rows.length} entries.`);
