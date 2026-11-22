// Search and paging for the admin's collection list. In memory: the list already reads the whole collection.

export const PAGE_SIZE = 25;

export type ListView<T> = {
  items: T[];
  /** Entries matching the search. */
  total: number;
  /** 1-based, clamped to the pages there are. */
  page: number;
  pages: number;
  /** 1-based range shown, e.g. 26–50. Both 0 when nothing matches. */
  from: number;
  to: number;
};

/** Reads `?page=` leniently: anything that isn't a whole number ≥ 1 is page 1. */
export const parsePage = (v: unknown) => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/** Filters by `q` (case-insensitive, in the title or the slug), then cuts out one page. */
export function listView<T extends { slug: string }>(items: T[], o: { q?: string; page?: number; size?: number; title: (item: T) => string }): ListView<T> {
  const size = o.size ?? PAGE_SIZE;
  const q = (o.q ?? '').trim().toLowerCase();
  const matches = q ? items.filter((i) => i.slug.toLowerCase().includes(q) || o.title(i).toLowerCase().includes(q)) : items;
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const page = Math.min(Math.max(1, Math.floor(o.page ?? 1)), pages);
  const start = (page - 1) * size;
  const slice = matches.slice(start, start + size);
  return { items: slice, total: matches.length, page, pages, from: slice.length ? start + 1 : 0, to: start + slice.length };
}
