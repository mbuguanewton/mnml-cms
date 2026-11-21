// Keyboard logic for a menu (WAI-ARIA menu button pattern), kept pure so it can be tested. Unlike a listbox, the
// arrows wrap around.

/** The item to focus after `key`, or null when the key doesn't move. */
export function menuKey(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
    case 'PageUp':
      return 0;
    case 'End':
    case 'PageDown':
      return count - 1;
    default:
      return null;
  }
}
