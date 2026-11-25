// The maths behind drag-to-reorder lists. No DOM, so it is tested on its own; `use-sortable.tsx` wires it to pointers and keys.

/** A copy of `list` with the item at `from` moved to `to`. Out-of-range indexes are clamped. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/**
 * Where the dragged row (`from`) ends up if dropped with the pointer at `y`: its index in the reordered list.
 * `mids` are the vertical centres of all rows (the dragged one included), top to bottom.
 */
export function dropIndex(mids: readonly number[], y: number, from: number): number {
  const above = mids.filter((m) => m < y).length;
  return Math.max(0, Math.min(mids.length - 1, above > from ? above - 1 : above));
}

/**
 * `dropIndex` for rows where some aren't rendered (`null`, e.g. a block no longer in the config): those can't be dropped
 * at, so they are skipped and the result is a real index. `mids[from]` must be a number.
 */
export function dropIndexAmong(mids: readonly (number | null)[], y: number, from: number): number {
  const present = mids.flatMap((m, k) => (m === null ? [] : [k]));
  const among = dropIndex(
    present.map((k) => mids[k]!),
    y,
    present.indexOf(from),
  );
  return present[among];
}

/** The index a key moves the row at `i` to, or null for a key that doesn't move rows. */
export function keyTarget(key: string, i: number, count: number): number | null {
  switch (key) {
    case 'ArrowUp':
      return Math.max(0, i - 1);
    case 'ArrowDown':
      return Math.min(count - 1, i + 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The index of the open row after the row at `from` moved to `to` (rows in between shift by one). */
export function followOpen(open: number | null, from: number, to: number): number | null {
  if (open === null) return null;
  if (open === from) return to;
  if (from < open && open <= to) return open - 1;
  if (to <= open && open < from) return open + 1;
  return open;
}

/** The line shown while dragging: the slot (0 to count) the row would drop before, or null when it stays put. */
export function dropSlot(from: number, to: number): number | null {
  return to === from ? null : to > from ? to + 1 : to;
}

/** What a screen reader hears after a move. */
export const movedMessage = (label: string, to: number, count: number) => `${label} moved to position ${to + 1} of ${count}`;

/**
 * Errors (or anything else) keyed by path (`footer.links.2.label`). After rows move or go, re-key the ones under `prefix` (the list's path)
 * so each follows its row. `map` gives a row's new index, or null if the row is gone (its errors are dropped).
 */
export function remapRowErrors<T = string>(errors: Record<string, T>, prefix: string, map: (i: number) => number | null): Record<string, T> {
  const head = `${prefix}.`;
  const out: Record<string, T> = {};
  for (const [key, message] of Object.entries(errors)) {
    const row = key.startsWith(head) ? /^(\d+)(\..*)?$/.exec(key.slice(head.length)) : null;
    if (!row) {
      out[key] = message;
      continue;
    }
    const to = map(Number(row[1]));
    if (to !== null) out[`${head}${to}${row[2] ?? ''}`] = message;
  }
  return out;
}
