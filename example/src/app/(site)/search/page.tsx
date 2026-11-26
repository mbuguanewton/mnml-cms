import Link from 'next/link';
import { cms } from '@/mnml';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  // The best passage of each published entry, best first: the same call a RAG pipeline or an agent makes.
  const hits = q ? await cms.search(q, { limit: 10 }) : [];
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 font-serif text-4xl font-semibold tracking-tight">Search</h1>
      <form action="/search" className="mb-10 flex gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search the site"
          aria-label="Search"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Search</button>
      </form>
      {q && hits.length === 0 && <p className="text-neutral-500">Nothing found for “{q}”.</p>}
      <ul className="space-y-8">
        {hits.map((h) => (
          <li key={`${h.key}/${h.slug}`}>
            {h.url ? (
              <Link href={h.url} className="font-serif text-xl font-semibold hover:underline">
                {h.title}
              </Link>
            ) : (
              <span className="font-serif text-xl font-semibold">{h.title}</span>
            )}
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{h.snippet}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
