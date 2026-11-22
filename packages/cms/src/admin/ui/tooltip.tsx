'use client';

import { slotted } from '../ui-context.js';
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { placePopover } from './position.js';
import type { TooltipProps } from './slots.js';

// Hover waits a moment, so moving across a toolbar doesn't flash every tooltip; keyboard focus shows it at once.
const HOVER_MS = 400;

/**
 * A short label for an icon button, shown on hover and on keyboard focus (not on a click), hidden with Escape.
 * Rendered in a `popover`, so it's never clipped. When the content just repeats the button's aria-label it isn't
 * linked again with aria-describedby.
 */
function TooltipBase({ content, children, side = 'top' }: TooltipProps) {
  const tipId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);

  const show = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    const el = tip.current;
    const anchor = wrap.current?.firstElementChild as HTMLElement | null;
    if (!el || !anchor) return;
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    if (!el.matches(':popover-open')) el.showPopover();
    placePopover(el, anchor, { side });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, side]);

  const props = isValidElement<{ 'aria-label'?: string; 'aria-describedby'?: string }>(children) ? children.props : {};
  const repeatsLabel = typeof content === 'string' && props['aria-label'] === content;
  const child =
    isValidElement(children) && !repeatsLabel
      ? cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
          'aria-describedby': [props['aria-describedby'], tipId].filter(Boolean).join(' '),
        })
      : children;

  return (
    <span
      ref={wrap}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(HOVER_MS)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches(':focus-visible') && show(0)}
      onBlur={hide}
    >
      {child}
      <span
        ref={tip}
        id={tipId}
        role="tooltip"
        popover="manual"
        className="pointer-events-none max-w-64 rounded-[6px] border-0 bg-mnml-primary px-2 py-1 text-xs font-medium text-mnml-on-primary shadow-md [font-family:ui-sans-serif,system-ui,sans-serif]"
      >
        {content}
      </span>
    </span>
  );
}

export const Tooltip = slotted('Tooltip', TooltipBase);
