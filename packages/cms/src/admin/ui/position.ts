// Places a `popover` element (top layer, position: fixed) next to its anchor: on the preferred side, flipped when
// there is no room, kept inside the viewport horizontally. With `fit`, a box that is taller than the room on either
// side is capped to the room on the roomier one (its content should scroll).

const GAP = 4;
const EDGE = 8;

/**
 * Where a box of `height` goes vertically: on the preferred `side` of the anchor, flipped if it doesn't fit there but
 * does on the other (or the other has more room). With `fit`, `maxHeight` is the room it is capped to when it fits nowhere.
 */
export function placeVertically({
  anchor,
  height,
  viewport,
  side = 'bottom',
  fit = false,
}: {
  anchor: { top: number; bottom: number };
  height: number;
  viewport: number;
  side?: 'top' | 'bottom';
  fit?: boolean;
}): { top: number; maxHeight?: number } {
  const below = viewport - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  const useBelow = side === 'top' ? !(above >= height || above > below) : below >= height || below > above;
  const room = Math.max(0, useBelow ? below : above);
  const capped = fit && height > room;
  const h = capped ? room : height;
  const top = useBelow ? anchor.bottom + GAP : anchor.top - GAP - h;
  return { top: Math.max(EDGE, top), ...(capped && { maxHeight: room }) };
}

export function placePopover(
  el: HTMLElement,
  anchor: HTMLElement,
  {
    side = 'bottom',
    matchWidth = false,
    align = matchWidth ? 'start' : 'center',
    fit = false,
  }: { side?: 'top' | 'bottom'; matchWidth?: boolean; align?: 'start' | 'center'; fit?: boolean } = {},
) {
  const a = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (matchWidth) el.style.minWidth = `${a.width}px`;
  el.style.position = 'fixed';
  el.style.margin = '0';
  el.style.inset = 'auto';
  el.style.maxWidth = `${vw - EDGE * 2}px`;
  if (fit) el.style.maxHeight = ''; // measure the natural height, not the cap of the last placement
  const r = el.getBoundingClientRect();
  const { top, maxHeight } = placeVertically({ anchor: a, height: r.height, viewport: vh, side, fit });
  if (fit && maxHeight !== undefined) el.style.maxHeight = `${maxHeight}px`;
  // Centred over the anchor for tooltips, left-aligned for lists and calendars.
  const left = align === 'start' ? a.left : a.left + a.width / 2 - r.width / 2;
  el.style.top = `${top}px`;
  el.style.left = `${Math.min(Math.max(EDGE, left), vw - EDGE - r.width)}px`;
}
