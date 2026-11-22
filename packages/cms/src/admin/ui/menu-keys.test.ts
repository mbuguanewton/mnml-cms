import { describe, expect, it } from 'vite-plus/test';
import { menuKey } from './menu-keys.js';

describe('menuKey', () => {
  it('moves down and up', () => {
    expect(menuKey('ArrowDown', 0, 3)).toBe(1);
    expect(menuKey('ArrowUp', 2, 3)).toBe(1);
  });
  it('wraps at both ends', () => {
    expect(menuKey('ArrowDown', 2, 3)).toBe(0);
    expect(menuKey('ArrowUp', 0, 3)).toBe(2);
  });
  it('jumps with Home/End and PageUp/PageDown', () => {
    expect(menuKey('Home', 2, 5)).toBe(0);
    expect(menuKey('End', 0, 5)).toBe(4);
    expect(menuKey('PageUp', 3, 5)).toBe(0);
    expect(menuKey('PageDown', 1, 5)).toBe(4);
  });
  it('ignores other keys', () => {
    expect(menuKey('Enter', 1, 3)).toBeNull();
    expect(menuKey('a', 1, 3)).toBeNull();
  });
  it('does nothing in an empty menu', () => {
    expect(menuKey('ArrowDown', 0, 0)).toBeNull();
  });
});
