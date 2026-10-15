// Fills the database with sample content: settings, a home page, authors and posts (one is a draft).
// Existing rows are left alone, so it is safe to run twice.
//   pnpm db:seed
import { existsSync } from 'node:fs';
import { entries, neonDatabase } from '@n3wtou/mnml-cms/db';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const db = neonDatabase(process.env.DATABASE_URL);

// Tiny helpers for rich-text (Tiptap JSON) content.
const text = (t: string) => ({ type: 'text', text: t });
const p = (...t: string[]) => ({ type: 'paragraph', content: t.map(text) });
const h2 = (t: string) => ({ type: 'heading', attrs: { level: 2 }, content: [text(t)] });
const quote = (t: string) => ({ type: 'blockquote', content: [p(t)] });
const list = (...items: string[]) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [p(i)] })) });
const doc = (...content: object[]) => ({ type: 'doc', content });

const seo = { title: '', description: '', image: null };

const rows = [
  {
    collection: 'settings',
    slug: 'singleton',
    data: {
      name: 'Field Notes',
      tagline: 'Short, useful writing on building calm software.',
      footer: {
        note: 'Built with mnml-cms',
        links: [
          { label: 'GitHub', url: 'https://github.com/mbuguanewton/mnml-cms' },
          { label: 'RSS', url: 'https://example.com/rss.xml' },
        ],
      },
    },
  },
  {
    collection: 'home',
    slug: 'singleton',
    data: {
      hero: {
        eyebrow: 'A small publication',
        headline: 'Notes on making software feel calm.',
        intro: 'Essays, guides and field reports on building simple, durable things for the web.',
        ctaLabel: 'Read the latest',
        ctaUrl: null,
        image: null,
      },
      featuredPost: 'one-table-is-enough',
      postCount: 6,
      seo: { title: 'Field Notes', description: 'Short, useful writing on building calm software.', image: null },
    },
  },
  {
    collection: 'authors',
    slug: 'ada-okafor',
    data: { name: 'Ada Okafor', role: 'Editor', bio: 'Ada edits Field Notes and writes about content systems and the people who use them.', photo: null },
  },
  {
    collection: 'authors',
    slug: 'sam-reyes',
    data: {
      name: 'Sam Reyes',
      role: 'Contributing engineer',
      bio: 'Sam builds web infrastructure and writes about databases, caching and small tools.',
      photo: null,
    },
  },
  {
    collection: 'posts',
    slug: 'one-table-is-enough',
    data: {
      title: 'One table is enough',
      summary: 'Why a single JSON table covers most content sites, and what you give up.',
      date: '2026-03-12',
      category: 'opinion',
      author: 'sam-reyes',
      cover: null,
      content: doc(
        p('Most content sites have a handful of content types and a few hundred entries. That is not a database design problem.'),
        h2('What a single table gives you'),
        list('No migrations when the content model changes.', 'One query shape for every type.', 'A schema that lives in code, next to the pages that use it.'),
        quote('The best schema is the one you can change on a Friday afternoon.'),
        h2('What you give up'),
        p('You cannot join across types in SQL, and you cannot index a field cheaply. For a blog or a brochure site, you will never notice.'),
      ),
      seo,
    },
  },
  {
    collection: 'posts',
    slug: 'writing-a-content-model',
    data: {
      title: 'Writing a content model you will not regret',
      summary: 'A practical checklist for deciding what is a field, what is a group and what is its own collection.',
      date: '2026-02-20',
      category: 'guide',
      author: 'ada-okafor',
      cover: null,
      content: doc(
        p('Start from the page, not the database. Sketch what an editor needs to change, then name each piece.'),
        h2('Fields, groups and collections'),
        list(
          'A field is a single value: a title, a date, a toggle.',
          'A group is a section of one page: the hero, the footer.',
          'A collection is anything an editor adds more of: posts, authors, products.',
        ),
        p('If you are unsure, begin with a group. Promoting it to a collection later is easy; the reverse rarely happens.'),
      ),
      seo,
    },
  },
  {
    collection: 'posts',
    slug: 'drafts-before-publishing',
    data: {
      title: 'Drafts first, publish when ready',
      summary: 'How a draft status keeps half-finished work off the site without a staging environment.',
      date: '2026-01-28',
      category: 'news',
      author: 'ada-okafor',
      cover: null,
      content: doc(p('Save a draft, preview it next to the editor, and publish only when it reads right.')),
      seo,
    },
  },
  {
    collection: 'posts',
    slug: 'caching-without-tears',
    data: {
      title: 'Caching without tears',
      summary: 'Revalidate on save, cache everything else. A short guide for small sites.',
      date: '2025-12-09',
      category: 'guide',
      author: 'sam-reyes',
      cover: null,
      content: doc(
        p('A small site rarely needs a cache strategy. It needs one rule: when content changes, tell the site.'),
        h2('The rule'),
        p('Revalidate when an editor saves. Everything between saves can be served from the cache.'),
      ),
      seo,
    },
  },
  {
    // A draft: hidden from the site, visible in the admin and in live preview.
    collection: 'posts',
    slug: 'upcoming-announcement',
    status: 'draft',
    data: {
      title: 'An announcement we are still writing',
      summary: 'This post is a draft, so it is not listed anywhere on the site.',
      date: '2026-04-01',
      category: 'news',
      author: 'ada-okafor',
      cover: null,
      content: doc(p('Publish it from the admin to see it appear on the homepage.')),
      seo,
    },
  },
];

const res = await db().insert(entries).values(rows).onConflictDoNothing().returning({ slug: entries.slug });
console.log(`Inserted ${res.length} of ${rows.length} entries.`);
