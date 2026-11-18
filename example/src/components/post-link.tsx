import Link from 'next/link';
import { Category } from './ui';

type LinkedPost = { title: string; summary: string; category: string | null };

/** A card in a post body linking another post (the rich-text `blockLink` node). */
export function PostLink({ slug, post }: { slug: string; post: LinkedPost | null | undefined }) {
  // The linked post was unpublished or deleted since: leave nothing behind.
  if (!post) return null;
  return (
    <Link href={`/posts/${slug}`} className="post-link not-prose">
      <Category>{post.category}</Category>
      <span className="post-link-title">{post.title}</span>
      {post.summary && <span className="post-link-summary">{post.summary}</span>}
    </Link>
  );
}
