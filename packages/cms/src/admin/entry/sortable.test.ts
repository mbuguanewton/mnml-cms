import { describe, expect, it } from 'vite-plus/test';
import { dropIndex, dropIndexAmong, dropSlot, followOpen, keyTarget, movedMessage, remapRowErrors, reorder } from './sortable.js';

describe('reorder', () => {
  it('moves an item up, down and to the ends', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(reorder(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(reorder(['a', 'b', 'c', 'd'], 1, 2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('leaves the list alone for the same index or a bad one, and never changes the input', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 1, 1)).toEqual(list);
    expect(reorder(list, 5, 0)).toEqual(list);
    expect(reorder(list, 0, 99)).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

describe('dropIndex', () => {
  const mids = [10, 30, 50, 70];
  it('keeps the row in place while the pointer is over it', () => {
    expect(dropIndex(mids, 28, 1)).toBe(1);
    expect(dropIndex(mids, 32, 1)).toBe(1);
  });
  it('moves down past the next centre, and up past the previous', () => {
    expect(dropIndex(mids, 55, 1)).toBe(2);
    expect(dropIndex(mids, 5, 2)).toBe(0);
    expect(dropIndex(mids, 25, 2)).toBe(1);
  });
  it('clamps at the ends', () => {
    expect(dropIndex(mids, -100, 3)).toBe(0);
    expect(dropIndex(mids, 900, 0)).toBe(3);
  });
});

describe('dropIndexAmong', () => {
  it('is dropIndex when every row is there', () => {
    expect(dropIndexAmong([10, 30, 50, 70], 55, 1)).toBe(2);
  });
  it('skips a row that is not rendered, and returns a real index', () => {
    const mids = [10, null, 50, 70]; // index 1 has no row
    expect(dropIndexAmong(mids, 80, 0)).toBe(3);
    expect(dropIndexAmong(mids, 30, 2)).toBe(2); // would be index 1 without the skip
    expect(dropIndexAmong(mids, 5, 3)).toBe(0);
  });
});

describe('keyTarget', () => {
  it('maps arrows, Home and End, clamped', () => {
    expect(keyTarget('ArrowUp', 2, 5)).toBe(1);
    expect(keyTarget('ArrowUp', 0, 5)).toBe(0);
    expect(keyTarget('ArrowDown', 2, 5)).toBe(3);
    expect(keyTarget('ArrowDown', 4, 5)).toBe(4);
    expect(keyTarget('Home', 3, 5)).toBe(0);
    expect(keyTarget('End', 1, 5)).toBe(4);
  });
  it('ignores other keys', () => {
    expect(keyTarget('Tab', 1, 5)).toBeNull();
    expect(keyTarget('a', 1, 5)).toBeNull();
  });
});

describe('followOpen', () => {
  it('follows the moved row', () => expect(followOpen(1, 1, 4)).toBe(4));
  it('shifts rows between the old and the new place', () => {
    expect(followOpen(2, 0, 3)).toBe(1); // moved down past it
    expect(followOpen(2, 4, 1)).toBe(3); // moved up past it
  });
  it('leaves rows outside the move, and a closed list, alone', () => {
    expect(followOpen(0, 2, 4)).toBe(0);
    expect(followOpen(5, 1, 3)).toBe(5);
    expect(followOpen(null, 1, 3)).toBeNull();
  });
});

describe('dropSlot', () => {
  it('is the gap the row would drop into', () => {
    expect(dropSlot(1, 1)).toBeNull();
    expect(dropSlot(1, 3)).toBe(4);
    expect(dropSlot(3, 1)).toBe(1);
  });
});

describe('movedMessage', () => {
  it('reads the position from 1', () => expect(movedMessage('Pricing', 1, 6)).toBe('Pricing moved to position 2 of 6'));
});

describe('remapRowErrors', () => {
  const errors = { 'links.2.label': 'Required', 'links.2.url': 'Bad', 'links.0.label': 'Short', title: 'Required', 'other.1.x': 'Keep' };
  it("re-keys a moved row's errors, and the rows it passed", () => {
    expect(remapRowErrors(errors, 'links', (i) => followOpen(i, 2, 0))).toEqual({
      'links.0.label': 'Required',
      'links.0.url': 'Bad',
      'links.1.label': 'Short',
      title: 'Required',
      'other.1.x': 'Keep',
    });
  });
  it('drops the errors of a row that is gone, and shifts the rest', () => {
    const gone = (i: number) => (i === 0 ? null : i - 1);
    expect(remapRowErrors(errors, 'links', gone)).toEqual({ 'links.1.label': 'Required', 'links.1.url': 'Bad', title: 'Required', 'other.1.x': 'Keep' });
  });
  it('only touches the list at that path', () => {
    expect(remapRowErrors(errors, 'links.2', () => 9)).toEqual(errors);
    expect(remapRowErrors({ 'linksX.1': 'a' }, 'links', () => 0)).toEqual({ 'linksX.1': 'a' });
  });
});
