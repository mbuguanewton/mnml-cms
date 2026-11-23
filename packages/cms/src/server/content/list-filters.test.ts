import { describe, expect, it } from 'vite-plus/test';
import { collection, fields } from '../../schema/define.js';
import {
  activeCount,
  applyFilters,
  cellText,
  columnChoices,
  columnCookie,
  columnSpecs,
  filterSpecs,
  filtersFollowColumns,
  listQuery,
  nextSort,
  parseColumnCookie,
  parseFilters,
  parseSort,
  serializeColumns,
  sortItems,
  visibleColumns,
  type ListItem,
} from './list-filters.js';

const posts = collection({
  label: 'Posts',
  titleField: 'title',
  basePath: '/posts',
  fields: {
    title: fields.text('Title'),
    date: fields.date('Date'),
    category: fields.select('Category', [
      { value: 'news', label: 'News' },
      { value: 'guide', label: 'Guide' },
    ] as const),
    featured: fields.boolean('Featured'),
    rating: fields.number('Rating'),
    publishedAt: fields.datetime('Published at'),
    author: fields.reference('Author', 'authors'),
    body: fields.richtext('Body'),
  },
});
const specs = filterSpecs(posts);
const item = (slug: string, entry: Record<string, unknown>, status: 'draft' | 'published' = 'published'): ListItem => ({ slug, entry, status });
const items = [
  item('a', { title: 'Banana', date: '2026-03-01', category: 'news', featured: true, rating: 4, publishedAt: '2026-03-01T23:30:00.000Z', author: 'ann' }),
  item('b', { title: 'apple', date: '2026-01-15', category: 'guide', rating: 10 }, 'draft'),
  item('c', { title: 'Cherry', category: 'news', featured: false, rating: 2, author: 'bob' }),
  item('d', { title: '', date: '2026-02-01', rating: 3 }),
];
const slugs = (xs: ListItem[]) => xs.map((i) => i.slug);
const noPending = new Set<string>();
const ctx = { pending: new Set(['c']), refLabel: (_c: string, s: string) => ({ ann: 'Zed Ann', bob: 'Bob' })[s] ?? s };

describe('filterSpecs', () => {
  it('offers every filterable field in config order by default', () => {
    expect(specs.map((s) => s.name)).toEqual(['date', 'category', 'featured', 'rating', 'publishedAt', 'author']);
  });
  it('follows the filters option, and false turns them off', () => {
    const c = (filters: never) =>
      collection({
        label: 'P',
        titleField: 'title',
        basePath: '/p',
        fields: { title: fields.text('T'), n: fields.number('N'), b: fields.boolean('B') },
        filters,
      });
    expect(filterSpecs(c(['b', 'n'] as never)).map((s) => s.name)).toEqual(['b', 'n']);
    expect(filterSpecs(c(false as never))).toEqual([]);
  });
});

describe('collection() checks', () => {
  const base = { label: 'P', titleField: 'title', basePath: '/p' } as const;
  const f = { title: fields.text('T'), body: fields.richtext('B'), n: fields.number('N') };
  it('rejects filters and columns that name a missing or unsupported field', () => {
    expect(() => collection({ ...base, fields: f, filters: ['nope'] as never })).toThrow(/not a field/);
    expect(() => collection({ ...base, fields: f, filters: ['body'] })).toThrow(/richtext/);
    expect(() => collection({ ...base, fields: f, columns: ['body'] })).toThrow(/richtext/);
    expect(() => collection({ ...base, fields: f, columns: ['n', 'n'] })).toThrow(/twice/);
  });
  it('accepts valid ones', () => {
    expect(collection({ ...base, fields: f, filters: ['n'], columns: ['title', 'n'] }).columns).toEqual(['title', 'n']);
  });
});

describe('parseFilters', () => {
  it('reads every kind, and ignores junk', () => {
    const f = parseFilters(
      {
        status: 'draft',
        'f.category': 'news',
        'f.featured': 'yes',
        'f.date.from': '2026-01-01',
        'f.date.to': '2026-12-31',
        'f.rating.min': '3',
        'f.author': 'ann',
      },
      specs,
    );
    expect(f).toEqual({
      status: 'draft',
      fields: {
        category: { eq: 'news' },
        featured: { eq: 'yes' },
        date: { from: '2026-01-01', to: '2026-12-31' },
        rating: { from: '3' },
        author: { eq: 'ann' },
      },
    });
    expect(activeCount(f)).toBe(7);
    const junk = parseFilters(
      { status: 'x', 'f.category': 'other', 'f.featured': 'maybe', 'f.date.from': 'tomorrow', 'f.rating.min': 'abc', 'f.nope': '1' },
      specs,
    );
    expect(junk).toEqual({ fields: {} });
  });
  it('takes the first of a repeated parameter', () => {
    expect(parseFilters({ 'f.category': ['guide', 'news'] }, specs).fields.category).toEqual({ eq: 'guide' });
  });
});

describe('applyFilters', () => {
  const run = (q: Record<string, string>) => slugs(applyFilters(items, parseFilters(q, specs), specs, ctx.pending));
  it('filters by status, with changes from the pending set', () => {
    expect(run({ status: 'draft' })).toEqual(['b']);
    expect(run({ status: 'changes' })).toEqual(['c']);
    expect(run({ status: 'published' })).toEqual(['a', 'd']);
  });
  it('filters by select, reference and boolean (no means not set too)', () => {
    expect(run({ 'f.category': 'news' })).toEqual(['a', 'c']);
    expect(run({ 'f.author': 'bob' })).toEqual(['c']);
    expect(run({ 'f.featured': 'yes' })).toEqual(['a']);
    expect(run({ 'f.featured': 'no' })).toEqual(['b', 'c', 'd']);
  });
  it('filters by date range, bounds inclusive, entries without a date excluded', () => {
    expect(run({ 'f.date.from': '2026-02-01' })).toEqual(['a', 'd']);
    expect(run({ 'f.date.to': '2026-02-01' })).toEqual(['b', 'd']);
    expect(run({ 'f.date.from': '2026-01-15', 'f.date.to': '2026-01-15' })).toEqual(['b']);
  });
  it('compares a datetime by its UTC day', () => {
    expect(run({ 'f.publishedAt.from': '2026-03-01', 'f.publishedAt.to': '2026-03-01' })).toEqual(['a']);
    expect(run({ 'f.publishedAt.from': '2026-03-02' })).toEqual([]);
  });
  it('filters by number range, entries without a number excluded', () => {
    expect(run({ 'f.rating.min': '3', 'f.rating.max': '4' })).toEqual(['a', 'd']);
    expect(run({ 'f.rating.min': '5' })).toEqual(['b']);
  });
  it('combines filters, and returns the same list when none are set', () => {
    expect(run({ 'f.category': 'news', status: 'changes' })).toEqual(['c']);
    expect(applyFilters(items, { fields: {} }, specs, noPending)).toBe(items);
  });
});

describe('columns and sorting', () => {
  const cols = columnSpecs(posts);
  it('defaults to the title, Slug, Status and the first date', () => {
    expect(cols.map((c) => c.key)).toEqual(['f.title', 'slug', 'status', 'f.date']);
  });
  it('follows the columns option: first field, Slug, Status, the rest', () => {
    const c = collection({
      label: 'P',
      titleField: 'title',
      basePath: '/p',
      fields: { title: fields.text('T'), n: fields.number('N'), b: fields.boolean('B') },
      columns: ['n', 'title', 'b'],
    });
    expect(columnSpecs(c).map((x) => x.key)).toEqual(['f.n', 'slug', 'status', 'f.title', 'f.b']);
  });
  const sorted = (key: string, dir: 'asc' | 'desc' = 'asc') => slugs(sortItems(items, { key, dir }, cols.concat(columnSpecs(posts)), ctx));
  const all = [
    ...cols,
    ...(['category', 'featured', 'rating', 'publishedAt', 'author'] as const).map((n) => ({ key: `f.${n}`, label: n, field: posts.fields[n] })),
  ];
  const by = (key: string, dir: 'asc' | 'desc' = 'asc') => slugs(sortItems(items, { key, dir }, all, ctx));

  it('sorts text without case, empty last in both directions', () => {
    expect(by('f.title')).toEqual(['b', 'a', 'c', 'd']);
    expect(by('f.title', 'desc')).toEqual(['c', 'a', 'b', 'd']);
  });
  it('sorts numbers numerically (10 after 4), dates as dates, empty last', () => {
    expect(by('f.rating')).toEqual(['c', 'd', 'a', 'b']);
    expect(by('f.date')).toEqual(['b', 'd', 'a', 'c']);
    expect(by('f.date', 'desc')).toEqual(['a', 'd', 'b', 'c']);
  });
  it('sorts a select by its label, a reference by its target title, a boolean no-first', () => {
    expect(by('f.category')).toEqual(['b', 'a', 'c', 'd']);
    expect(by('f.author')).toEqual(['c', 'a', 'b', 'd']);
    expect(by('f.featured')).toEqual(['b', 'c', 'd', 'a']);
  });
  it('sorts status Draft, Changes, Published and keeps ties in order', () => {
    expect(by('status')).toEqual(['b', 'c', 'a', 'd']);
    expect(by('status', 'desc')).toEqual(['a', 'd', 'c', 'b']);
  });
  it('sorts by slug', () => {
    expect(by('slug', 'desc')).toEqual(['d', 'c', 'b', 'a']);
    expect(sorted('slug')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('leaves the order alone with no sort, and does not change the input', () => {
    expect(sortItems(items, undefined, all, ctx)).toBe(items);
    by('f.title');
    expect(slugs(items)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('shows cells as text', () => {
    expect(
      cellText(
        items[0],
        all.find((c) => c.key === 'f.category')!,
        ctx,
      ),
    ).toBe('News');
    expect(
      cellText(
        items[0],
        all.find((c) => c.key === 'f.featured')!,
        ctx,
      ),
    ).toBe('Yes');
    expect(
      cellText(
        items[0],
        all.find((c) => c.key === 'f.publishedAt')!,
        ctx,
      ),
    ).toBe('2026-03-01 23:30 UTC');
    expect(
      cellText(
        items[0],
        all.find((c) => c.key === 'f.author')!,
        ctx,
      ),
    ).toBe('Zed Ann');
    expect(
      cellText(
        items[1],
        all.find((c) => c.key === 'status')!,
        ctx,
      ),
    ).toBe('draft');
  });
});

describe('parseSort and nextSort', () => {
  const cols = columnSpecs(posts);
  it('reads a known column and ignores others', () => {
    expect(parseSort({ sort: 'f.date', dir: 'desc' }, cols)).toEqual({ key: 'f.date', dir: 'desc' });
    expect(parseSort({ sort: 'slug' }, cols)).toEqual({ key: 'slug', dir: 'asc' });
    expect(parseSort({ sort: 'f.nope' }, cols)).toBeUndefined();
    expect(parseSort({}, cols)).toBeUndefined();
  });
  it('cycles ascending, descending, default', () => {
    const a = nextSort(undefined, 'slug');
    expect(a).toEqual({ key: 'slug', dir: 'asc' });
    expect(nextSort(a, 'slug')).toEqual({ key: 'slug', dir: 'desc' });
    expect(nextSort({ key: 'slug', dir: 'desc' }, 'slug')).toBeUndefined();
    expect(nextSort({ key: 'slug', dir: 'desc' }, 'status')).toEqual({ key: 'status', dir: 'asc' });
  });
});

describe('listQuery', () => {
  it('writes the list state, leaving out what is not set', () => {
    expect(listQuery({ filters: { fields: {} } }, specs)).toBe('');
    const filters = parseFilters({ status: 'draft', 'f.category': 'news', 'f.rating.min': '3' }, specs);
    expect(listQuery({ q: ' hi ', filters, sort: { key: 'f.date', dir: 'desc' }, page: 2 }, specs)).toBe(
      '?q=hi&status=draft&f.category=news&f.rating.min=3&sort=f.date&dir=desc&page=2',
    );
    expect(listQuery({ filters, page: 1 }, specs)).not.toContain('page');
  });
  it('round-trips through parseFilters', () => {
    const f = parseFilters({ 'f.date.from': '2026-01-01', 'f.featured': 'no' }, specs);
    const q = Object.fromEntries(new URLSearchParams(listQuery({ filters: f }, specs)));
    expect(parseFilters(q, specs)).toEqual(f);
  });
});

describe('column choices', () => {
  const keys = (cols: { key: string }[]) => cols.map((c) => c.key);
  it('offers Slug, Status and every showable field except the first column', () => {
    expect(keys(columnChoices(posts))).toEqual(['slug', 'status', 'f.date', 'f.category', 'f.featured', 'f.rating', 'f.publishedAt', 'f.author']);
  });
  it('follows columnChoices, and false offers nothing', () => {
    const c = (columnChoices: never) =>
      collection({
        label: 'P',
        titleField: 'title',
        basePath: '/p',
        fields: { title: fields.text('T'), n: fields.number('N'), b: fields.boolean('B'), body: fields.richtext('Body') },
        columnChoices,
      });
    expect(keys(columnChoices(c(['b'] as never)))).toEqual(['slug', 'status', 'f.b']);
    expect(columnChoices(c(false as never))).toEqual([]);
    expect(keys(columnChoices(c(undefined as never)))).toEqual(['slug', 'status', 'f.n', 'f.b']);
  });
  it('lists the default columns first, in their order, so hiding one never reshuffles the rest', () => {
    const c = collection({
      label: 'P',
      titleField: 'title',
      basePath: '/p',
      fields: {
        title: fields.text('T'),
        date: fields.date('D'),
        category: fields.select('C', ['a'] as const),
        featured: fields.boolean('F'),
        n: fields.number('N'),
      },
      columns: ['title', 'featured', 'category'],
    });
    expect(keys(columnChoices(c))).toEqual(['slug', 'status', 'f.featured', 'f.category', 'f.date', 'f.n']);
    expect(keys(visibleColumns(c, 'f.category,f.featured,status'))).toEqual(['f.title', 'status', 'f.featured', 'f.category']);
  });
  it('rejects columnChoices that name a missing or unsupported field when the config loads', () => {
    const f = { title: fields.text('T'), body: fields.richtext('B') };
    const base = { label: 'P', titleField: 'title', basePath: '/p' } as const;
    expect(() => collection({ ...base, fields: f, columnChoices: ['body'] })).toThrow(/columnChoices names "body"/);
    expect(() => collection({ ...base, fields: f, columnChoices: ['nope'] as never })).toThrow(/not a field/);
  });

  it('reads the cookie, and ignores junk', () => {
    expect([...parseColumnCookie('f.category,slug')!]).toEqual(['f.category', 'slug']);
    expect(parseColumnCookie('-')).toEqual(new Set());
    expect([...parseColumnCookie('f.category,<script>,x')!]).toEqual(['f.category']);
    for (const v of [undefined, '', 'nonsense', 'a b,c']) expect(parseColumnCookie(v)).toBeUndefined();
    expect(parseColumnCookie(Array.from({ length: 200 }, () => 'slug').join(','))!.size).toBe(1);
  });
  it('round-trips through serializeColumns and names the cookie per collection', () => {
    expect(serializeColumns(['slug', 'f.date'])).toBe('slug,f.date');
    expect(serializeColumns([])).toBe('-');
    expect(parseColumnCookie(serializeColumns([]))).toEqual(new Set());
    expect(columnCookie('posts')).toBe('mnml_cols_posts');
  });

  it('shows the default columns without a (valid) cookie', () => {
    const def = keys(columnSpecs(posts));
    for (const v of [undefined, 'junk!!']) expect(keys(visibleColumns(posts, v))).toEqual(def);
  });
  it('shows the first column plus the chosen ones, in menu order, ignoring keys that are not choices', () => {
    expect(keys(visibleColumns(posts, 'f.featured,slug,f.category'))).toEqual(['f.title', 'slug', 'f.category', 'f.featured']);
    expect(keys(visibleColumns(posts, 'f.title,f.body,f.nope,status'))).toEqual(['f.title', 'status']);
    expect(keys(visibleColumns(posts, '-'))).toEqual(['f.title']);
  });
  it('ignores the cookie when the developer turned the choice off', () => {
    const fixed = collection({
      label: 'P',
      titleField: 'title',
      basePath: '/p',
      fields: { title: fields.text('T'), n: fields.number('N') },
      columns: ['title', 'n'],
      columnChoices: false,
    });
    expect(keys(visibleColumns(fixed, '-'))).toEqual(['f.title', 'slug', 'status', 'f.n']);
  });
  it('keeps the first column of a custom columns option as the fixed one', () => {
    const c = collection({
      label: 'P',
      titleField: 'title',
      basePath: '/p',
      fields: { title: fields.text('T'), n: fields.number('N') },
      columns: ['n', 'title'],
    });
    expect(keys(columnChoices(c))).toEqual(['slug', 'status', 'f.title']);
    expect(keys(visibleColumns(c, 'f.title'))).toEqual(['f.n', 'f.title']);
  });
  it('drops a sort on a hidden column', () => {
    const cols = visibleColumns(posts, 'slug');
    expect(parseSort({ sort: 'f.category' }, cols)).toBeUndefined();
    expect(parseSort({ sort: 'slug' }, cols)).toEqual({ key: 'slug', dir: 'asc' });
  });
});

describe('filtersFollowColumns', () => {
  const names = (r: { specs: { name: string }[] }) => r.specs.map((s) => s.name);
  it('keeps every filter before an editor has chosen columns', () => {
    const r = filtersFollowColumns(specs, columnSpecs(posts), false);
    expect(names(r)).toEqual(['date', 'category', 'featured', 'rating', 'publishedAt', 'author']);
    expect(r.status).toBe(true);
  });
  it('keeps only the filters whose column shows once they have, and Status with its column', () => {
    const r = filtersFollowColumns(specs, visibleColumns(posts, 'f.category,f.featured'), true);
    expect(names(r)).toEqual(['category', 'featured']);
    expect(r.status).toBe(false);
    expect(filtersFollowColumns(specs, visibleColumns(posts, 'status'), true)).toMatchObject({ status: true, specs: [] });
  });
  it('brings a filter back when its column does', () => {
    expect(names(filtersFollowColumns(specs, visibleColumns(posts, 'f.category,f.rating'), true))).toEqual(['category', 'rating']);
  });
  it('drops the filter of a hidden column from the URL it reads', () => {
    const shown = filtersFollowColumns(specs, visibleColumns(posts, 'f.featured'), true);
    const filters = parseFilters({ 'f.category': 'news', 'f.featured': 'yes' }, shown.specs);
    expect(filters.fields).toEqual({ featured: { eq: 'yes' } });
  });
});
