'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronUpIcon, ExternalLinkIcon, HouseIcon, LogOutIcon, ShieldOffIcon } from 'lucide-react';
import { menuItemClass } from './action-menu.js';
import { useAdmin } from './context.js';

export type NavItem = { href: string; label: string; icon: React.ReactNode };
export type NavGroup = { title: string; items: NavItem[] };

const itemClass = 'flex shrink-0 items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 no-underline [&_svg]:size-4';

export function AdminNav({ brand, groups, signOutEverywhere }: { brand: string; groups: NavGroup[]; signOutEverywhere?: boolean }) {
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
          <SignOut apiPath={apiPath} everywhere={!!signOutEverywhere} />
        </div>
      </nav>
    </aside>
  );
}

/** Sign out, as a split button: the main part signs out here; the arrow offers "Sign out everywhere". */
function SignOut({ apiPath, everywhere }: { apiPath: string; everywhere: boolean }) {
  const { confirm } = useAdmin();
  const root = useRef<HTMLDivElement>(null);
  // `fixed`, measured from the arrow, so the menu isn't clipped by the sidebar (a scrolling strip on narrow screens).
  const [menu, setMenu] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setMenu(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 224, window.innerWidth - 232));
    // Open upward from the sidebar's footer, or downward when the button is near the top (narrow screens).
    setMenu(r.top > window.innerHeight / 2 ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
  };

  return (
    <div ref={root} className="flex shrink-0">
      <form action={`${apiPath}/logout`} method="post" className="flex-1">
        <button type="submit" className={`${itemClass} cms-state w-full cursor-pointer text-cms-text-soft`}>
          <LogOutIcon /> Sign out
        </button>
      </form>
      {everywhere && (
        <>
          <button
            type="button"
            aria-label="More sign out options"
            aria-haspopup="menu"
            aria-expanded={!!menu}
            onClick={toggle}
            className="cms-state flex shrink-0 cursor-pointer items-center rounded-[6px] px-1.5 text-cms-text-soft [&_svg]:size-4"
          >
            <ChevronUpIcon />
          </button>
          <div
            role="menu"
            hidden={!menu}
            className="z-30 rounded-[8px] border border-cms-line bg-cms-bg p-1 shadow-lg"
            style={{ position: 'fixed', width: 224, ...menu }}
          >
            <form
              action={`${apiPath}/logout-all`}
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setMenu(null);
                const ok = await confirm({
                  title: 'Sign out everywhere?',
                  description: 'Every signed-in device, including this one, will need to sign in again.',
                  confirmLabel: 'Sign out everywhere',
                  danger: true,
                });
                if (ok) form.submit(); // submit() skips this handler
              }}
            >
              <button type="submit" role="menuitem" className={menuItemClass}>
                <ShieldOffIcon /> Sign out everywhere
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
