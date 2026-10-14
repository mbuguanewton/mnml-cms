import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { seoMetadata } from '@n3wtou/mnml-cms';
import { RichText } from '@n3wtou/mnml-cms/rich-text';
import { cms } from '@/mnml';
import { editor } from '@/mnml-editor';
import { Category, Picture, formatDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await cms.getEntry('posts', (await params).slug);
  return post ? seoMetadata(post.seo, { title: post.title, description: post.summary, image: post.cover }) : {};
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await cms.getEntry('posts', slug);
  if (!post) notFound();
  const author = post.author ? await cms.getEntry('authors', post.author) : null;
  const meta = [formatDate(post.date), post.readingTime && `${post.readingTime} min read`].filter(Boolean).join(' · ');
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/posts" className="text-sm text-soft hover:text-accent">← All posts</Link>
      <header className="mt-8 flex flex-col gap-4">
        <Category>{post.category}</Category>
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{post.title}</h1>
        {post.summary && <p className="text-xl text-soft">{post.summary}</p>}
        <p className="text-sm text-mute">
          {author && post.author && (
            <>
              By <Link href={`/authors/${post.author}`} className="text-ink hover:text-accent">{author.name}</Link>
              {meta && ' · '}
            </>
          )}
          {meta}
        </p>
      </header>
      {post.cover && <Picture image={post.cover} className="my-10 aspect-[16/9] w-full rounded-xl" />}
      <RichText content={post.content} editor={editor} className="article mt-10" />
    </main>
  );
}
