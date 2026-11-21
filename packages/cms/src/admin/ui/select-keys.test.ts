import { describe, expect, it } from 'vite-plus/test';
import { isTypeahead, selectKey, typeahead } from './select-keys.js';

const closed = { open: false, active: 0 };
const at = (active: number) => ({ open: true, active });
const key = (k: string, extra: { altKey?: boolean } = {}) => ({ key: k, ...extra });

describe('selectKey: closed', () => {
  it('opens on ArrowDown, ArrowUp, Enter and Space at the selected option', () => {
    for (const k of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      expect(selectKey(closed, key(k), 2, 5)).toEqual({ state: at(2), handled: true });
    }
  });

  it('opens at the first option when nothing is selected', () => {
    expect(selectKey(closed, key('ArrowDown'), -1, 5).state).toEqual(at(0));
  });

  it('opens at the first or last option on Home and End', () => {
    expect(selectKey(closed, key('Home'), 3, 5).state).toEqual(at(0));
    expect(selectKey(closed, key('End'), 0, 5).state).toEqual(at(4));
  });

  it('leaves other keys alone', () => {
    expect(selectKey(closed, key('Tab'), 0, 5)).toEqual({ state: closed, handled: false });
    expect(selectKey(closed, key('Escape'), 0, 5).handled).toBe(false);
  });

  it('does nothing without options', () => {
    expect(selectKey(closed, key('ArrowDown'), -1, 0)).toEqual({ state: closed, handled: false });
  });
});

describe('selectKey: open', () => {
  it('moves with the arrows and stops at the ends (no wrap)', () => {
    expect(selectKey(at(1), key('ArrowDown'), 1, 3).state).toEqual(at(2));
    expect(selectKey(at(2), key('ArrowDown'), 1, 3).state).toEqual(at(2));
    expect(selectKey(at(1), key('ArrowUp'), 1, 3).state).toEqual(at(0));
    expect(selectKey(at(0), key('ArrowUp'), 1, 3).state).toEqual(at(0));
  });

  it('jumps with Home, End, PageUp and PageDown', () => {
    expect(selectKey(at(5), key('Home'), 0, 30).state).toEqual(at(0));
    expect(selectKey(at(5), key('End'), 0, 30).state).toEqual(at(29));
    expect(selectKey(at(5), key('PageDown'), 0, 30).state).toEqual(at(15));
    expect(selectKey(at(25), key('PageDown'), 0, 30).state).toEqual(at(29));
    expect(selectKey(at(5), key('PageUp'), 0, 30).state).toEqual(at(0));
  });

  it('picks the active option and closes on Enter, Space and Alt+ArrowUp', () => {
    for (const e of [key('Enter'), key(' '), key('ArrowUp', { altKey: true })]) {
      expect(selectKey(at(2), e, 0, 5)).toEqual({ state: { open: false, active: 2 }, pick: 2, handled: true });
    }
  });

  it('closes without picking on Escape', () => {
    const r = selectKey(at(2), key('Escape'), 0, 5);
    expect(r).toEqual({ state: { open: false, active: 2 }, handled: true });
    expect(r.pick).toBeUndefined();
  });

  it('picks on Tab but lets focus move on', () => {
    expect(selectKey(at(3), key('Tab'), 0, 5)).toEqual({ state: { open: false, active: 3 }, pick: 3, handled: false });
  });
});

describe('typeahead', () => {
  const labels = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Avocado'];

  it('finds the next label starting with a letter, after the current one, wrapping', () => {
    expect(typeahead(labels, 'b', 0)).toBe(1);
    expect(typeahead(labels, 'a', 0)).toBe(4);
    expect(typeahead(labels, 'a', 4)).toBe(0);
  });

  it('starts at the first option when nothing is selected', () => {
    expect(typeahead(labels, 'a', -1)).toBe(0);
  });

  it('cycles through matches when the same letter is repeated', () => {
    expect(typeahead(labels, 'bb', 1)).toBe(2);
    expect(typeahead(labels, 'bbb', 2)).toBe(1);
  });

  it('matches a longer prefix, staying on the current option if it still matches', () => {
    expect(typeahead(labels, 'bl', 1)).toBe(2);
    expect(typeahead(labels, 'ban', 1)).toBe(1);
  });

  it('is case-insensitive and returns -1 without a match', () => {
    expect(typeahead(labels, 'CH', 0)).toBe(3);
    expect(typeahead(labels, 'z', 0)).toBe(-1);
    expect(typeahead([], 'a', 0)).toBe(-1);
  });
});

describe('isTypeahead', () => {
  it('accepts single printable characters without modifiers', () => {
    expect(isTypeahead({ key: 'a' })).toBe(true);
    expect(isTypeahead({ key: '1' })).toBe(true);
    expect(isTypeahead({ key: ' ' })).toBe(false);
    expect(isTypeahead({ key: 'ArrowDown' })).toBe(false);
    expect(isTypeahead({ key: 'a', metaKey: true })).toBe(false);
    expect(isTypeahead({ key: 'c', ctrlKey: true })).toBe(false);
  });
});
