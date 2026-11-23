// Internal (not exported from the package). Which field types the admin list can filter by and show as columns.

export const FILTER_TYPES: ReadonlySet<string> = new Set(['select', 'boolean', 'date', 'datetime', 'number', 'reference']);
export const COLUMN_TYPES: ReadonlySet<string> = new Set(['text', 'url', 'date', 'datetime', 'number', 'boolean', 'select', 'reference']);
