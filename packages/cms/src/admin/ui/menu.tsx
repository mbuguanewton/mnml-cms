'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, MoreHorizontalIcon } from 'lucide-react';
import { buttonVariants } from './button.js';
import { menuKey } from './menu-keys.js';
import { placePopover } from './position.js';
import { isTypeahead, typeahead } from './select-keys.js';
import type { MenuProps } from './slots.js';
import { Tooltip } from './tooltip.js';

const TYPEAHEAD_MS = 600;

const itemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-sm text-mnml-text outline-none hover:bg-mnml-surface focus-visible:bg-mnml-surface aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-mnml-text-mute';

/**
 * A button that opens a menu of actions (WAI-ARIA menu button). The menu is a `popover` (never clipped). Arrows
 * (wrapping), Home/End, type-ahead, Enter or Space to run an item, Escape to close; focus returns to the button.
 */
export function Menu({ label, items, trigger, className }: MenuProps) {
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef({ q: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const itemEls = () => [...(list.current?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])];

  useLayoutEffect(() => {
    const el = list.current;
    if (!el || !button.current) return;
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    if (!el.matches(':popover-open')) el.showPopover();
    placePopover(el, button.current, { matchWidth: true });
  }, [open]);

  useEffect(() => {
    if (open) itemEls()[active]?.focus();
  }, [open, active]);

  // While open: close on a press outside, follow the button when the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) close(false);
    };
    const follow = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return;
      if (list.current && button.current) placePopover(list.current, button.current, { matchWidth: true });
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  const run = (i: number) => {
    const item = items[i];
    if (!item || item.disabled) return;
    close(true);
    item.onSelect();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openAt(e.key === 'ArrowDown' ? 0 : items.length - 1);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Handled here, so a fullscreen editor or a dialog around the menu stays open.
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (isTypeahead(e)) {
      const now = Date.now();
      const s = search.current;
      s.q = now - s.at > TYPEAHEAD_MS ? e.key : s.q + e.key;
      s.at = now;
      const hit = typeahead(
        items.map((o) => o.label),
        s.q,
        active,
      );
      e.preventDefault();
      if (hit >= 0) setActive(hit);
      return;
    }
    const next = menuKey(e.key, active, items.length);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    }
  };

  const triggerButton = (
    <button
      ref={button}
      type="button"
      aria-label={trigger ? undefined : label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => (open ? close(true) : openAt(0))}
      onKeyDown={onTriggerKey}
      className={className ?? buttonVariants({ variant: 'ghost', size: trigger ? 'default' : 'icon' })}
    >
      {trigger ?? <MoreHorizontalIcon />}
    </button>
  );

  return (
    <>
      {trigger ? triggerButton : <Tooltip content={label}>{triggerButton}</Tooltip>}
      <div
        ref={list}
        id={menuId}
        role="menu"
        aria-label={label}
        popover="manual"
        onKeyDown={onListKey}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null;
          if (open && to && !list.current?.contains(to) && !button.current?.contains(to)) close(false);
        }}
        className="min-w-44 rounded-[8px] border border-mnml-line bg-mnml-bg p-1 text-mnml-text shadow-lg [font-family:ui-sans-serif,system-ui,sans-serif]"
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            data-menu-item
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            aria-disabled={item.disabled || undefined}
            tabIndex={i === active ? 0 : -1}
            onPointerMove={() => i !== active && setActive(i)}
            onClick={() => run(i)}
            className={`${itemClass} ${item.danger ? 'text-mnml-danger [&_svg]:text-mnml-danger' : ''}`}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.checked && <CheckIcon aria-hidden className="!size-3.5 !text-mnml-text" />}
          </button>
        ))}
      </div>
    </>
  );
}
