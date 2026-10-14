import { cms } from '@/mnml';
import { PostCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Posts' };

export default async function Posts() {
  const posts = await cms.listEntries('posts', { orderBy: 'date', order: 'desc' });
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-10 font-serif text-4xl font-semibold tracking-tight">All posts</h1>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.slug} {...p} />
        ))}
      </div>
    </main>
  );
}
