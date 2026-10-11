'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLinkIcon, HouseIcon, LogOutIcon } from 'lucide-react';
import { useAdmin } from './context.js';

export type NavItem = { href: string; label: string; icon: React.ReactNode };
export type NavGroup = { title: string; items: NavItem[] };

const itemClass = 'flex shrink-0 items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 no-underline [&_svg]:size-4';

export function AdminNav({ brand, groups }: { brand: string; groups: NavGroup[] }) {
  const pathname = usePathname();
  const { adminPath, apiPath } = useAdmin();
  const item = ({ href, label, icon }: NavItem, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${itemClass} ${active ? 'bg-cms-surface font-medium text-cms-text' : 'cms-state text-cms-text-soft'}`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <aside className="flex shrink-0 flex-col border-cms-line bg-cms-panel md:sticky md:top-0 md:h-dvh md:w-60 md:border-r max-md:border-b">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-cms-line px-4">
        <span className="flex size-7 items-center justify-center rounded-[6px] bg-cms-primary font-cms-brand text-lg font-bold text-cms-on-primary">
          {brand[0] ?? 'A'}
        </span>
        <span className="truncate font-semibold">{brand}</span>
      </div>
      <nav className="flex gap-0.5 p-2 max-md:overflow-x-auto md:flex-1 md:flex-col">
        {item({ href: adminPath, label: 'Dashboard', icon: <HouseIcon /> }, pathname === adminPath)}
        {groups.map((g) => (
          <div key={g.title} className="flex gap-0.5 md:flex-col">
            <div className="px-2.5 pb-1 pt-4 text-xs font-medium text-cms-text-mute max-md:hidden">{g.title}</div>
            {g.items.map((i) => item(i, pathname === i.href || pathname.startsWith(`${i.href}/`)))}
          </div>
        ))}
        <div className="flex gap-0.5 md:mt-auto md:flex-col md:border-t md:border-cms-line md:pt-2">
          <Link href="/" target="_blank" className={`${itemClass} cms-state text-cms-text-soft`}>
            <ExternalLinkIcon /> View site
          </Link>
          <form action={`${apiPath}/logout`} method="post">
            <button type="submit" className={`${itemClass} cms-state w-full cursor-pointer text-cms-text-soft`}>
              <LogOutIcon /> Sign out
            </button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
