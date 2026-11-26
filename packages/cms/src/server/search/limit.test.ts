import { describe, expect, it } from 'vite-plus/test';
import { createLimiter } from './limit.js';

describe('createLimiter', () => {
  it('allows `max` calls a window, then says how long to wait', () => {
    const limit = createLimiter({ max: 2, windowMs: 60_000 });
    expect(limit('ip', 0)).toBe(0);
    expect(limit('ip', 1000)).toBe(0);
    expect(limit('ip', 2000)).toBe(58);
    expect(limit('other', 2000)).toBe(0);
  });
  it('starts a new window', () => {
    const limit = createLimiter({ max: 1, windowMs: 1000 });
    expect(limit('ip', 0)).toBe(0);
    expect(limit('ip', 500)).toBe(1);
    expect(limit('ip', 1000)).toBe(0);
  });
});
