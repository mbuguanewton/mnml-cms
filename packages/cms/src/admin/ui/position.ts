// Places a `popover` element (top layer, position: fixed) next to its anchor: on the preferred side, flipped when
// there is no room, kept inside the viewport horizontally.

const GAP = 4;
const EDGE = 8;

export function placePopover(
  el: HTMLElement,
  anchor: HTMLElement,
  {
    side = 'bottom',
    matchWidth = false,
    align = matchWidth ? 'start' : 'center',
  }: { side?: 'top' | 'bottom'; matchWidth?: boolean; align?: 'start' | 'center' } = {},
) {
  const a = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (matchWidth) el.style.minWidth = `${a.width}px`;
  el.style.position = 'fixed';
  el.style.margin = '0';
  el.style.inset = 'auto';
  el.style.maxWidth = `${vw - EDGE * 2}px`;
  const r = el.getBoundingClientRect();
  const below = vh - a.bottom - GAP - EDGE;
  const above = a.top - GAP - EDGE;
  const top =
    side === 'top'
      ? above >= r.height || above > below
        ? a.top - GAP - r.height
        : a.bottom + GAP
      : below >= r.height || below > above
        ? a.bottom + GAP
        : a.top - GAP - r.height;
  // Centred over the anchor for tooltips, left-aligned for lists and calendars.
  const left = align === 'start' ? a.left : a.left + a.width / 2 - r.width / 2;
  el.style.top = `${Math.max(EDGE, top)}px`;
  el.style.left = `${Math.min(Math.max(EDGE, left), vw - EDGE - r.width)}px`;
}
