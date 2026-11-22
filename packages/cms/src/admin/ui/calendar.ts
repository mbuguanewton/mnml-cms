// Date logic for the date picker, kept pure so it can be tested. Dates are `YYYY-MM-DD` strings; date-fns does the
// maths on local dates (whole days only, so time zones and daylight saving don't shift them).
import { addDays, addMonths, addWeeks, addYears, endOfWeek, format, isValid, parse, startOfMonth, startOfWeek } from 'date-fns';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const FMT = 'yyyy-MM-dd';
const toDate = (iso: string) => parse(iso, FMT, new Date());
const toIso = (d: Date) => format(d, FMT);

/** Typed text as a `YYYY-MM-DD` date, or null when it isn't one (wrong shape, or a day that doesn't exist). */
export function parseDate(text: string): string | null {
  const t = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = toDate(t);
  return isValid(d) && toIso(d) === t ? t : null;
}

/**
 * Typed text as a date and time: `YYYY-MM-DD HH:mm` (or with `T`), or a date alone (`time` null). Null when the
 * date doesn't exist or the time is out of range.
 */
export function parseDateTime(text: string): { date: string; time: string | null } | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text.trim());
  const date = m ? parseDate(m[1]) : null;
  if (!m || !date) return null;
  if (m[2] === undefined) return { date, time: null };
  const h = Number(m[2]);
  const min = Number(m[3]);
  if (h > 23 || min > 59) return null;
  return { date, time: `${String(h).padStart(2, '0')}:${m[3]}` };
}

/** Today in this machine's time zone. */
export const today = () => toIso(new Date());

/** The month containing `iso`, as six weeks of dates (so the grid never changes height), starting on `weekStartsOn`. */
export function monthGrid(iso: string, weekStartsOn: WeekStart): string[][] {
  const first = startOfWeek(startOfMonth(toDate(iso)), { weekStartsOn });
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => toIso(addDays(first, w * 7 + d))));
}

/** Whether two dates are in the same month. */
export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** `iso` moved by `n` months; the day clamps to the month's end (Jan 31 + 1 is Feb 28 or 29). */
export const shiftMonth = (iso: string, n: number) => toIso(addMonths(toDate(iso), n));

/**
 * The day to focus after `key` in the grid (WAI-ARIA date picker): arrows by day and week, Home/End to the week's
 * start and end, PageUp/PageDown by month, with Shift by year. Null when the key doesn't move.
 */
export function moveDay(iso: string, key: string, { shift = false, weekStartsOn = 1 as WeekStart } = {}): string | null {
  const d = toDate(iso);
  switch (key) {
    case 'ArrowLeft':
      return toIso(addDays(d, -1));
    case 'ArrowRight':
      return toIso(addDays(d, 1));
    case 'ArrowUp':
      return toIso(addWeeks(d, -1));
    case 'ArrowDown':
      return toIso(addWeeks(d, 1));
    case 'Home':
      return toIso(startOfWeek(d, { weekStartsOn }));
    case 'End':
      return toIso(endOfWeek(d, { weekStartsOn }));
    case 'PageUp':
      return toIso(shift ? addYears(d, -1) : addMonths(d, -1));
    case 'PageDown':
      return toIso(shift ? addYears(d, 1) : addMonths(d, 1));
    default:
      return null;
  }
}

/** The first day of the week for a locale (0 = Sunday), from `Intl.Locale` week info; Monday when unknown. */
export function weekStartFor(locale: string): WeekStart {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const first = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay;
    if (first) return (first % 7) as WeekStart;
  } catch {
    // An invalid locale tag: fall through.
  }
  return 1;
}
