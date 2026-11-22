// Internal (not exported from the package).

/** A stored value as display text: strings, numbers and booleans as-is, anything else (objects, null) as ''. */
export const displayText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint' ? String(v) : '';
