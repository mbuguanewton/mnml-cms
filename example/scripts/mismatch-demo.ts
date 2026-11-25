// Makes entries whose stored values no longer fit their fields, as if the config had changed after they were saved:
// open them in /admin to settle each one (Use this, or Remove). Safe to run twice (it resets them).
//   pnpm db:mismatch
import { existsSync } from 'node:fs';
import { entries, neonDatabase } from '@n3wtou/mnml-cms/db';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const db = neonDatabase(process.env.DATABASE_URL);

const text = (t: string) => ({ type: 'text', text: t });
const doc = (...paras: string[]) => ({ type: 'doc', content: paras.map((t) => ({ type: 'paragraph', content: [text(t)] })) });
const seo = { title: '', description: '', image: null };

const rows = [
  {
    collection: 'posts',
    slug: 'stale-values-demo',
    status: 'published',
    data: {
      title: 'Stale values demo',
      // `summary` used to be rich text: it still holds a document, with a heading and bold text. Use this turns it into
      // plain text, and the card says what is lost.
      summary: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [text('Written as rich text')] },
          { type: 'paragraph', content: [{ type: 'text', text: 'It has a ' }, { type: 'text', text: 'bold', marks: [{ type: 'bold' }] }, text(' word.')] },
        ],
      },
      // `date` used to be free text.
      date: 'November 24, 2026',
      // `category` used to be labels: "How-to guide" matches an option by its label.
      category: 'How-to guide',
      // `featured` used to be a text field.
      featured: 'yes',
      // `publishedAt` used to be a number of milliseconds.
      publishedAt: Date.UTC(2026, 10, 24, 10, 0),
      // `related` used to be one text field. Use this splits it.
      related: 'hello-world, second-post',
      // No conversion for these: Remove is the only choice.
      cover: 42,
      author: { name: 'Ada' },
      content: doc('The post body.'),
      seo,
    },
  },
  {
    collection: 'pages',
    slug: 'stale-values-demo',
    status: 'published',
    data: {
      title: 'Stale values in a section',
      // A mismatch inside a block: `eyebrow` was a number field once.
      sections: [{ kind: 'hero', eyebrow: 7, title: 'Hello', intro: '' }],
      seo,
    },
  },
];

for (const r of rows) {
  await db()
    .insert(entries)
    .values(r)
    .onConflictDoUpdate({ target: [entries.collection, entries.slug], set: { data: r.data, status: r.status, updatedAt: new Date() } });
}
console.log(`Wrote ${rows.length} entries with stale values: /admin/posts/stale-values-demo and /admin/pages/stale-values-demo`);
