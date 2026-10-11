import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';

export type Crumb = { label: string; href?: string };

/** Sticky top bar: breadcrumbs on the left, page actions on the right. */
export function AdminHeader({ crumbs, children }: { crumbs: Crumb[]; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-cms-line bg-cms-bg/95 px-6 backdrop-blur">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRightIcon className="size-3.5 shrink-0 text-cms-text-mute" />}
            {c.href ? (
              <Link href={c.href} className="shrink-0 text-cms-text-soft no-underline hover:text-cms-text">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}
