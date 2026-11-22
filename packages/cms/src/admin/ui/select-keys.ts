// Keyboard logic for Select (the WAI-ARIA "select-only combobox" pattern), kept pure so it can be tested.
// Focus stays on the button; `active` is the option highlighted with aria-activedescendant.

export type SelectState = { open: boolean; active: number };

export type SelectKeyResult = {
  state: SelectState;
  /** Index of the option to pick (the list closes too). */
  pick?: number;
  /** Call preventDefault(): the key was ours. */
  handled: boolean;
};

const PAGE = 10;

/**
 * What a key does. `selected` is the index of the current value (-1 for none), `count` the number of options.
 * Printable characters (type-ahead) are handled by `typeahead`, not here.
 */
export function selectKey(state: SelectState, e: { key: string; altKey?: boolean }, selected: number, count: number): SelectKeyResult {
  const last = count - 1;
  const clamp = (i: number) => Math.max(0, Math.min(last, i));
  const start = selected >= 0 ? selected : 0;
  const open = (active: number): SelectKeyResult => ({ state: { open: true, active: clamp(active) }, handled: true });

  if (count === 0) return { state, handled: false };

  if (!state.open) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        return open(start);
      case 'Home':
        return open(0);
      case 'End':
        return open(last);
      default:
        return { state, handled: false };
    }
  }

  const closed = { open: false, active: state.active };
  switch (e.key) {
    case 'ArrowDown':
      return open(state.active + 1);
    case 'ArrowUp':
      // Alt+Up picks and closes, like a native select.
      return e.altKey ? { state: closed, pick: state.active, handled: true } : open(state.active - 1);
    case 'Home':
      return open(0);
    case 'End':
      return open(last);
    case 'PageDown':
      return open(state.active + PAGE);
    case 'PageUp':
      return open(state.active - PAGE);
    case 'Enter':
    case ' ':
      return { state: closed, pick: state.active, handled: true };
    case 'Escape':
      return { state: closed, handled: true };
    case 'Tab':
      // Picks the highlighted option, then lets focus move on.
      return { state: closed, pick: state.active, handled: false };
    default:
      return { state, handled: false };
  }
}

/** A single printable character, without Ctrl/Meta/Alt: the start of a type-ahead search. */
export const isTypeahead = (e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }) =>
  e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * The option a type-ahead `query` lands on: the first label starting with it, searching after `from` (or from it, for
 * a longer query that may still match it) and wrapping. One letter, or the same letter repeated ("aaa"), cycles
 * through the labels starting with it. -1 if none match.
 */
export function typeahead(labels: string[], query: string, from: number): number {
  const q = query.toLowerCase();
  if (!q || labels.length === 0) return -1;
  const same = q.replaceAll(q[0], '') === '';
  // A first letter (or the same letter again) moves past the current option; a longer query may stay on it.
  const start = from < 0 ? 0 : from + (same ? 1 : 0);
  const needle = same ? q[0] : q;
  for (let i = 0; i < labels.length; i++) {
    const at = (start + i) % labels.length;
    if (labels[at].toLowerCase().startsWith(needle)) return at;
  }
  return -1;
}
