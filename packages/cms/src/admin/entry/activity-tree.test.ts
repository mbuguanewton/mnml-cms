import { describe, expect, it } from 'vite-plus/test';
import type { ActivityEvent } from '../../api.js';
import { brief, dayLabel, groupByDay } from './activity-tree.js';

const ev = (at: string, id = at): ActivityEvent => ({ id, key: 'posts', slug: 'a', action: 'publish', by: { type: 'admin', label: 'Admin' }, at });
const now = new Date(2026, 10, 27, 15, 0);

describe('groupByDay', () => {
  it('groups newest-first events under a node for each day, in order', () => {
    const days = groupByDay(
      [
        ev(new Date(2026, 10, 27, 14).toISOString(), 'a'),
        ev(new Date(2026, 10, 27, 9).toISOString(), 'b'),
        ev(new Date(2026, 10, 26, 20).toISOString(), 'c'),
        ev(new Date(2026, 10, 1, 8).toISOString(), 'd'),
      ],
      now,
    );
    expect(days.map((d) => d.label.startsWith('Today') || d.label)).toEqual([true, 'Yesterday', expect.stringContaining('1')]);
    expect(days.map((d) => d.events.map((e) => e.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('skips events with a time it cannot read', () => {
    expect(groupByDay([ev('nope')], now)).toEqual([]);
  });
});

describe('dayLabel', () => {
  it('says Today and Yesterday', () => {
    expect(dayLabel(new Date(2026, 10, 27, 1), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 26, 23), now)).toBe('Yesterday');
  });
});

describe('brief', () => {
  it('cuts long values and writes non-strings as JSON', () => {
    expect(brief('x'.repeat(200), 10)).toBe('xxxxxxxxxx…');
    expect(brief({ a: 1 })).toBe('{"a":1}');
    expect(brief(undefined)).toBe('');
  });
});
