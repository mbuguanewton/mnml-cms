'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { MoreVerticalIcon } from 'lucide-react';
import { Button } from './button.js';

export const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-sm text-cms-text no-underline outline-none transition-colors hover:bg-cms-surface focus-visible:bg-cms-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-cms-text-mute';

/** A row in an ActionMenu. Use `danger` for destructive actions. */
export function MenuItem({ danger, className = '', ...props }: ComponentProps<'button'> & { danger?: boolean }) {
  return <button type="button" role="menuitem" className={`${menuItemClass} ${danger ? 'text-cms-danger [&_svg]:text-cms-danger' : ''} ${className}`} {...props} />;
}

/** The header's "more" menu: secondary actions behind one button, so the header stays calm. */
export function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button type="button" variant="ghost" size="icon" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreVerticalIcon />
      </Button>
      {/* Kept mounted (just hidden) so an item's own state, e.g. a pending delete, survives closing. */}
      <div role="menu" hidden={!open} onClick={() => setOpen(false)} className="absolute right-0 top-full z-20 mt-1 w-48 rounded-[8px] border border-cms-line bg-cms-bg p-1 shadow-lg">
        {children}
      </div>
    </div>
  );
}
