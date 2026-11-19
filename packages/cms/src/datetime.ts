// Datetimes are stored as UTC ISO strings in one format (`toISOString()`: 2026-11-18T14:30:00.000Z), so sorting the
// strings sorts them in time. The admin input shows them in the editor's own time zone.
import { format, isValid, parse, parseISO } from 'date-fns';

// date-fns reads a value without a zone as local time, which would depend on the server: require one.
const HAS_ZONE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * An ISO 8601 date and time with `Z` or an offset (`2026-11-18T17:30+03:00`), as the stored UTC string; null if it
 * isn't one, has no zone, or names a date that doesn't exist (Feb 31).
 */
export function normalizeDatetime(value: string): string | null {
  const v = value.trim();
  if (!v.includes('T') || !HAS_ZONE.test(v)) return null;
  const d = parseISO(v);
  return isValid(d) ? d.toISOString() : null;
}

const LOCAL_INPUT = "yyyy-MM-dd'T'HH:mm";

/** A stored datetime as a `datetime-local` input value in this machine's time zone (to the minute); '' if empty. */
export function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? parseISO(iso) : null;
  return d && isValid(d) ? format(d, LOCAL_INPUT) : '';
}

/** A `datetime-local` input value (this machine's time zone) as the stored UTC string; null if empty or invalid. */
export function fromLocalInput(value: string): string | null {
  const d = parse(value, LOCAL_INPUT, new Date());
  return isValid(d) ? d.toISOString() : null;
}
