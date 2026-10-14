import { notFound } from 'next/navigation';
import { cms } from '@/mnml';
import { Picture, PostCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await cms.getEntry('authors', slug);
  if (!author) notFound();
  const posts = await cms.listEntries('posts', { filter: (p) => p.author === slug, orderBy: 'date', order: 'desc' });
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-14 flex items-center gap-6">
        <Picture image={author.photo} className="size-24 rounded-full" />
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{author.name}</h1>
          {author.role && <p className="text-accent">{author.role}</p>}
          {author.bio && <p className="mt-2 max-w-xl text-soft">{author.bio}</p>}
        </div>
      </header>
      <h2 className="mb-8 border-b border-line pb-3 font-serif text-2xl font-semibold">Posts</h2>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.slug} {...p} />
        ))}
      </div>
    </main>
  );
}
