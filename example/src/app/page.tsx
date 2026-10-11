import Link from 'next/link';
import { cms } from '@/cms';

// Reads the database on every request, so the build doesn't need DATABASE_URL.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const settings = await cms.getSingleton('settings');
  const posts = await cms.listEntries('posts');
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>{settings?.name || 'Example'}</h1>
      <p>{settings?.tagline}</p>
      <ul>
        {posts.map(({ slug, entry }) => (
          <li key={slug}>
            <Link href={`/posts/${slug}`}>{entry.title}</Link>
          </li>
        ))}
      </ul>
      <p><Link href="/admin">Admin</Link></p>
    </main>
  );
}
