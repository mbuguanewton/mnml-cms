'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GripVerticalIcon } from 'lucide-react';
import { buttonVariants } from '../ui/button-variants.js';
import { Tooltip } from '../ui/tooltip.js';
import { dropIndexAmong, dropSlot, keyTarget, movedMessage } from './sortable.js';

type Drag = { from: number; to: number; dy: number; list: HTMLElement };

// Near the top or bottom of the scrolling area, a drag scrolls it. Letting go this far outside the list cancels.
const EDGE = 56;
const CANCEL_MARGIN = 80;

/** The nearest ancestor that scrolls vertically, or null for the page. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** The rows of a list by index (a row can be missing, e.g. a block that is no longer in the config). */
const rowsOf = (list: HTMLElement, count: number) => {
  const found = new Map<number, HTMLElement>();
  for (const el of list.querySelectorAll<HTMLElement>(':scope > [data-mnml-row]')) found.set(Number(el.dataset.mnmlRow), el);
  return Array.from({ length: count }, (_, i) => found.get(i) ?? null);
};

const centre = (el: HTMLElement) => {
  const b = el.getBoundingClientRect();
  return b.top + b.height / 2;
};

/**
 * Drag-to-reorder for a list: spread `rowProps(i)` on each row (the direct children of the list) and `handleProps(i)` on
 * its `DragHandle`. Pointer events (mouse, touch and pen), and the arrow keys, Home and End on a focused handle.
 * `onMove(from, to)` gets each completed move. The DOM is read from the handle's own list, so there are no refs.
 */
export function useSortable({ count, onMove, labelOf }: { count: number; onMove: (from: number, to: number) => void; labelOf: (i: number) => string }) {
  const grab = useRef(0);
  const pointerY = useRef(0);
  const current = useRef<Drag | null>(null);
  const refocus = useRef<{ list: HTMLElement; i: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [message, setMessage] = useState('');

  // The drag is kept in a ref too, set at once: a quick tap can end before React has rendered the state.
  const setDragNow = (d: Drag | null) => {
    current.current = d;
    setDrag(d);
  };
  const announce = (m: string) => setMessage((prev) => (prev === m ? `${m}\u00a0` : m));

  /** Follows the pointer: the lifted row's offset, and the place it would drop. */
  const track = (clientY: number) => {
    const d = current.current;
    if (!d) return;
    const rows = rowsOf(d.list, count);
    const lifted = rows[d.from];
    if (!lifted) return;
    const rest = centre(lifted) - d.dy; // where the row sits without the lift
    const mids = rows.map((r, k) => (k === d.from ? rest : r ? centre(r) : null)); // null: not rendered (a block no longer in the config)
    const middle = clientY - grab.current;
    const next = { ...d, to: dropIndexAmong(mids, middle, d.from), dy: middle - rest };
    if (next.to !== d.to || next.dy !== d.dy) setDragNow(next);
  };

  // While dragging: Escape cancels, and the nearest scroller follows the pointer at its edges.
  const active = drag !== null;
  useEffect(() => {
    const list = current.current?.list;
    if (!active || !list) return;
    // Capture phase, and stopped: Escape ends the drag only, not the dialog or panel the list is in.
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      setDragNow(null);
    };
    document.addEventListener('keydown', esc, true);
    const scroller = scrollParent(list);
    let frame = 0;
    const loop = () => {
      const box = scroller?.getBoundingClientRect();
      const top = box ? box.top : 0;
      const bottom = box ? box.bottom : window.innerHeight;
      const y = pointerY.current;
      const speed = y < top + EDGE ? -Math.min(16, (top + EDGE - y) / 4) : y > bottom - EDGE ? Math.min(16, (y - (bottom - EDGE)) / 4) : 0;
      if (speed) {
        if (scroller) scroller.scrollTop += speed;
        else window.scrollBy(0, speed);
        track(y);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener('keydown', esc, true);
      cancelAnimationFrame(frame);
    };
    // `track` reads refs only, and `count` can't change mid-drag.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // After a keyboard move the row is a different one at that index: put focus back on its handle.
  useEffect(() => {
    const f = refocus.current;
    if (!f) return;
    f.list.querySelector<HTMLElement>(`:scope > [data-mnml-row="${f.i}"] [data-mnml-handle]`)?.focus();
    refocus.current = null;
  });

  const moved = (list: HTMLElement, from: number, to: number) => {
    onMove(from, to);
    announce(movedMessage(labelOf(from), to, count));
    refocus.current = { list, i: to };
  };

  const slot = drag ? dropSlot(drag.from, drag.to) : null;

  return {
    /** True while a row is being dragged. */
    dragging: drag !== null,
    rowProps: (i: number): { 'data-mnml-row': number; style?: CSSProperties; className: string } => ({
      'data-mnml-row': i,
      className: drag?.from === i ? 'relative z-10 bg-mnml-bg shadow-lg ring-1 ring-mnml-line' : 'relative',
      style: drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined,
    }),
    /** The drop line, inside row `i`: at its top edge, or at the bottom edge of the last row. */
    line: (i: number): ReactNode =>
      slot === i || (slot === count && i === count - 1) ? (
        <span aria-hidden className={`pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-mnml-primary ${slot === i ? 'top-0' : 'bottom-0'}`} />
      ) : null,
    /** A screen reader hears each move. Render it once beside the list. */
    status: (
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    ),
    handleProps: (i: number) => ({
      'data-mnml-handle': '',
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const row = e.currentTarget.closest<HTMLElement>('[data-mnml-row]');
        const list = row?.parentElement;
        if (!row || !list) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = e.clientY - centre(row);
        pointerY.current = e.clientY;
        setDragNow({ from: i, to: i, dy: 0, list });
      },
      onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
        pointerY.current = e.clientY;
        track(e.clientY);
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        const d = current.current;
        if (!d) return;
        setDragNow(null);
        const r = d.list.getBoundingClientRect();
        const outside =
          e.clientX < r.left - CANCEL_MARGIN ||
          e.clientX > r.right + CANCEL_MARGIN ||
          e.clientY < r.top - CANCEL_MARGIN ||
          e.clientY > r.bottom + CANCEL_MARGIN;
        if (d.to !== d.from && !outside) moved(d.list, d.from, d.to);
      },
      onPointerCancel: () => setDragNow(null),
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const to = keyTarget(e.key, i, count);
        const list = e.currentTarget.closest<HTMLElement>('[data-mnml-row]')?.parentElement;
        if (to === null || !list) return;
        e.preventDefault();
        if (to !== i) moved(list, i, to);
      },
    }),
  };
}

/** The grip that starts a drag. Spread `handleProps(i)` on it. */
export function DragHandle({ label, ...props }: { label: string } & ReturnType<ReturnType<typeof useSortable>['handleProps']>) {
  return (
    <Tooltip content="Drag, or use the arrow keys">
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        {...props}
        className={`${buttonVariants({ variant: 'ghost', size: 'icon-xs' })} cursor-grab touch-none text-mnml-text-mute active:cursor-grabbing`}
      >
        <GripVerticalIcon />
      </button>
    </Tooltip>
  );
}
