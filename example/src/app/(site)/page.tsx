import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@n3wtou/mnml-cms';
import { cms } from '@/mnml';
import { Picture, PostCard } from '@/components/ui';

// Reads the database on every request, so the build doesn't need DATABASE_URL.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, home] = await Promise.all([cms.getSingleton('settings'), cms.getSingleton('home')]);
  return seoMetadata(home?.seo, {
    title: settings?.name,
    description: settings?.tagline,
  });
}

export default async function Home() {
  const [settings, home] = await Promise.all([cms.getSingleton('settings'), cms.getSingleton('home')]);
  const hero = home?.hero;
  const featured = home?.featuredPost ? await cms.getEntry('posts', home.featuredPost) : null;
  // Newest first; drafts are never listed.
  const latest = (await cms.listEntries('posts', { orderBy: 'date', order: 'desc' }))
    .filter((p) => p.slug !== home?.featuredPost)
    .slice(0, home?.postCount ?? 6);

  return (
    <main>
      <section className="mx-auto grid max-w-5xl gap-10 px-6 pb-16 pt-16 md:grid-cols-[1.2fr_1fr] md:items-center md:pt-24">
        <div className="flex flex-col items-start gap-5">
          {hero?.eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-accent">{hero.eyebrow}</p>}
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{hero?.headline || settings?.name}</h1>
          <p className="max-w-lg text-lg text-soft">{hero?.intro || settings?.tagline}</p>
          {hero?.ctaLabel && (
            <Link href={hero.ctaUrl ?? '/posts'} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-accent">
              {hero.ctaLabel}
            </Link>
          )}
        </div>
        {hero?.image && <Picture image={hero.image} className="aspect-[4/3] w-full rounded-2xl" />}
      </section>

      {featured && home?.featuredPost && (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <PostCard slug={home.featuredPost} entry={featured} large />
        </section>
      )}

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-8 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Latest</h2>
          <Link href="/posts" className="text-sm text-soft hover:text-accent">
            All posts →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="text-soft">Nothing published yet. Add a post in the admin.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => (
              <PostCard key={p.slug} {...p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
