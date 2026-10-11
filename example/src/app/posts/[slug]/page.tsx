import { notFound } from 'next/navigation';
import { RichText } from '@n3wtou/mnml-cms/rich-text';
import { cms } from '@/cms';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await cms.getEntry('posts', slug);
  if (!post) notFound();
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>{post.title}</h1>
      <p>{post.summary}</p>
      <RichText content={post.content} />
    </main>
  );
}
