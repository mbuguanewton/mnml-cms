import { describe, expect, it } from 'vite-plus/test';
import { collection, fields } from '../../schema/define.js';
import {
  activeCount,
  applyFilters,
  cellText,
  columnSpecs,
  filterSpecs,
  listQuery,
  nextSort,
  parseFilters,
  parseSort,
  sortItems,
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
