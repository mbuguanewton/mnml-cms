import Link from 'next/link';
import { cms } from '@/cms';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await cms.getSingleton('settings');
  return (
    <>
      <cms.PreviewBanner />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
            {settings?.name || 'Example'}
          </Link>
          <nav className="flex items-center gap-6 text-sm text-soft">
            <Link href="/posts" className="hover:text-ink">Posts</Link>
            <Link href="/admin" className="rounded-full border border-line px-3 py-1 hover:border-ink hover:text-ink">Admin</Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-line text-sm text-soft">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p>
            {settings?.copyright}
            {settings?.footer.note && ` · ${settings.footer.note}`}
          </p>
          <ul className="flex gap-5">
            {settings?.footer.links.map((l) => (
              <li key={l.url}>
                <a href={l.url ?? '#'} className="hover:text-ink">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
