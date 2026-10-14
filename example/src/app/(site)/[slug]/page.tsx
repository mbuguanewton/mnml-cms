import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { seoMetadata } from '@n3wtou/mnml-cms';
import { RichText } from '@n3wtou/mnml-cms/rich-text';
import { cms } from '@/mnml';
import { editor } from '@/mnml-editor';
import { PostCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await cms.getEntry('pages', (await params).slug);
  return page ? seoMetadata(page.seo, { title: page.title }) : {};
}

export default async function Page({ params }: Props) {
  const page = await cms.getEntry('pages', (await params).slug);
  if (!page) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-16">
      {/* `section.kind` narrows the type: only a hero has `intro`, only latestPosts has `count`. */}
      {await Promise.all(
        page.sections.map(async (section, i) => {
          switch (section.kind) {
            case 'hero':
              return (
                <header key={i} className="flex flex-col gap-4">
                  {section.eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-accent">{section.eyebrow}</p>}
                  <h1 className="font-serif text-5xl font-semibold tracking-tight">{section.title}</h1>
                  {section.intro && <p className="text-lg text-soft">{section.intro}</p>}
                </header>
              );
            case 'text':
              return <RichText key={i} content={section.content} editor={editor} className="article" />;
            case 'latestPosts': {
              const posts = await cms.listEntries('posts', { orderBy: 'date', order: 'desc', limit: section.count ?? 3 });
              return (
                <section key={i} className="flex flex-col gap-6">
                  {section.title && <h2 className="font-serif text-2xl font-semibold">{section.title}</h2>}
                  {posts.map((p) => (
                    <PostCard key={p.slug} {...p} />
                  ))}
                </section>
              );
            }
            case 'divider':
              return <hr key={i} className="border-line" />;
          }
        }),
      )}
    </main>
  );
}
