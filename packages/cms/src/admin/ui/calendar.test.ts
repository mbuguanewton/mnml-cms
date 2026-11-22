import { describe, expect, it } from 'vite-plus/test';
import { monthGrid, moveDay, parseDate, parseDateTime, sameMonth, shiftMonth, weekStartFor } from './calendar.js';

describe('parseDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(parseDate('2026-11-21')).toBe('2026-11-21');
    expect(parseDate(' 2024-02-29 ')).toBe('2024-02-29');
  });
  it('rejects other shapes and days that do not exist', () => {
    expect(parseDate('21/11/2026')).toBeNull();
    expect(parseDate('2026-2-1')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2025-02-29')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('parseDateTime', () => {
  it('reads a date and time, with a space or T', () => {
    expect(parseDateTime('2026-11-22 14:30')).toEqual({ date: '2026-11-22', time: '14:30' });
    expect(parseDateTime('2026-11-22T9:05')).toEqual({ date: '2026-11-22', time: '09:05' });
  });
  it('reads a date alone', () => {
    expect(parseDateTime('2026-11-22')).toEqual({ date: '2026-11-22', time: null });
  });
  it('rejects bad dates and times', () => {
    expect(parseDateTime('2026-02-30 10:00')).toBeNull();
    expect(parseDateTime('2026-11-22 24:00')).toBeNull();
    expect(parseDateTime('2026-11-22 10:60')).toBeNull();
    expect(parseDateTime('22/11/2026 10:00')).toBeNull();
  });
});

describe('monthGrid', () => {
  it('is six weeks starting on Monday', () => {
    const g = monthGrid('2026-11-21', 1);
    expect(g).toHaveLength(6);
    expect(g.every((w) => w.length === 7)).toBe(true);
    // 1 Nov 2026 is a Sunday: the Monday before is 26 Oct.
    expect(g[0][0]).toBe('2026-10-26');
    expect(g[0][6]).toBe('2026-11-01');
  });
  it('starts on Sunday when asked', () => {
    const g = monthGrid('2026-11-21', 0);
    expect(g[0][0]).toBe('2026-11-01');
    expect(g[5][6]).toBe('2026-12-12');
  });
  it('covers a leap February', () => {
    const days = monthGrid('2024-02-10', 1).flat();
    expect(days).toContain('2024-02-29');
    expect(days.filter((d) => sameMonth(d, '2024-02-01'))).toHaveLength(29);
  });
});

describe('moveDay', () => {
  it('moves by day and week across month and year ends', () => {
    expect(moveDay('2026-11-30', 'ArrowRight')).toBe('2026-12-01');
    expect(moveDay('2026-01-01', 'ArrowLeft')).toBe('2025-12-31');
    expect(moveDay('2026-12-29', 'ArrowDown')).toBe('2027-01-05');
    expect(moveDay('2026-11-03', 'ArrowUp')).toBe('2026-10-27');
  });
  it('goes to the start and end of the week', () => {
    // Sat 21 Nov 2026.
    expect(moveDay('2026-11-21', 'Home', { weekStartsOn: 1 })).toBe('2026-11-16');
    expect(moveDay('2026-11-21', 'End', { weekStartsOn: 1 })).toBe('2026-11-22');
    expect(moveDay('2026-11-21', 'Home', { weekStartsOn: 0 })).toBe('2026-11-15');
  });
  it('moves by month and year, clamping the day', () => {
    expect(moveDay('2026-01-31', 'PageDown')).toBe('2026-02-28');
    expect(moveDay('2024-01-31', 'PageDown')).toBe('2024-02-29');
    expect(moveDay('2026-03-31', 'PageUp')).toBe('2026-02-28');
    expect(moveDay('2024-02-29', 'PageDown', { shift: true })).toBe('2025-02-28');
    expect(moveDay('2026-11-21', 'PageUp', { shift: true })).toBe('2025-11-21');
  });
  it('ignores other keys', () => {
    expect(moveDay('2026-11-21', 'Enter')).toBeNull();
  });
});

describe('shiftMonth', () => {
  it('clamps to the end of a shorter month', () => {
    expect(shiftMonth('2026-05-31', 1)).toBe('2026-06-30');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('weekStartFor', () => {
  it('reads the locale, Monday when unknown', () => {
    expect([0, 1]).toContain(weekStartFor('en-US'));
    expect(weekStartFor('de-DE')).toBe(1);
    expect(weekStartFor('not a locale!')).toBe(1);
  });
});
