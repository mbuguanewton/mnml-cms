import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { fromLocalInput, normalizeDatetime, toLocalInput } from './datetime.js';
import { fields, initialValues, objectSchema } from './define.js';

describe('normalizeDatetime', () => {
  it('stores any offset as UTC in one format', () => {
    expect(normalizeDatetime('2026-11-18T14:30:00Z')).toBe('2026-11-18T14:30:00.000Z');
    expect(normalizeDatetime('2026-11-18T17:30+03:00')).toBe('2026-11-18T14:30:00.000Z');
    expect(normalizeDatetime('2026-11-18T09:30:15.5-05:00')).toBe('2026-11-18T14:30:15.500Z');
  });

  it('accepts 24:00 as midnight at the end of the day (ISO 8601)', () => {
    expect(normalizeDatetime('2026-11-18T24:00Z')).toBe('2026-11-19T00:00:00.000Z');
  });

  it('rejects values without a zone, other formats and dates that do not exist', () => {
    for (const bad of ['2026-11-18T14:30', '2026-11-18', '18/11/2026 14:30Z', '2026-02-31T10:00Z', '2026-11-18T23:60Z', 'soon']) {
      expect(normalizeDatetime(bad), bad).toBeNull();
    }
  });
});

describe('local time in the admin input', () => {
  const tz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = tz;
  });

  it('shows UTC in the local zone, across daylight saving time', () => {
    expect(toLocalInput('2026-01-15T15:00:00.000Z')).toBe('2026-01-15T10:00'); // EST, UTC-5
    expect(toLocalInput('2026-07-01T14:00:00.000Z')).toBe('2026-07-01T10:00'); // EDT, UTC-4
  });

  it('saves local input as UTC, and round-trips without drift', () => {
    expect(fromLocalInput('2026-01-15T10:00')).toBe('2026-01-15T15:00:00.000Z');
    expect(fromLocalInput('2026-07-01T10:00')).toBe('2026-07-01T14:00:00.000Z');
    for (const local of ['2026-01-15T10:00', '2026-03-08T01:59', '2026-03-08T03:00', '2026-11-01T00:30']) {
      expect(toLocalInput(fromLocalInput(local))).toBe(local);
    }
  });

  it('treats empty or malformed input as no value', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('nope')).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-01-15')).toBeNull();
  });
});

describe('datetime field', () => {
  const s = objectSchema({ at: fields.datetime('At') });

  it('validates and normalizes on save, with blank as null', () => {
    expect(s.parse({ at: '2026-11-18T17:30+03:00' })).toEqual({ at: '2026-11-18T14:30:00.000Z' });
    expect(s.parse({ at: '' })).toEqual({ at: null });
    expect(s.safeParse({ at: '2026-11-18T14:30' }).success).toBe(false);
  });

  it('can be required', () => {
    expect(objectSchema({ at: fields.datetime('At', { required: true }) }).safeParse({ at: '' }).success).toBe(false);
  });

  it('starts empty, or with a default such as now', () => {
    expect(initialValues({ at: fields.datetime('At') })).toEqual({ at: null });
    const before = Date.now();
    const { at } = initialValues({ at: fields.datetime('At', { default: () => new Date().toISOString() }) });
    expect(Date.parse(at!)).toBeGreaterThanOrEqual(before);
    expect(normalizeDatetime(at!)).toBe(at);
  });
});
