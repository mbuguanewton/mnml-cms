import { describe, expect, it } from 'vite-plus/test';
import { block, fields, withDefaults, type Fields } from './define.js';
import { convertValue, docFromText, docToText, fieldAt, fieldLabelAt, fitDefaults, lossNote, reviewEntry, setIn } from './fit.js';

const doc = (...texts: string[]) => ({ type: 'doc', content: texts.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) });

const all = {
  title: fields.text('Title', { required: true }),
  summary: fields.textarea('Summary'),
  date: fields.date('Date'),
  at: fields.datetime('At'),
  link: fields.url('Link'),
  count: fields.number('Count'),
  on: fields.boolean('On'),
  kind: fields.select('Kind', ['a', 'b'] as const),
  who: fields.reference('Who', 'authors'),
  more: fields.references('More', 'posts'),
  body: fields.richtext('Body'),
  tags: fields.tags('Tags'),
  cover: fields.image('Cover'),
  seo: fields.group('SEO', { title: fields.text('Title') }),
  rows: fields.array('Rows', { name: fields.text('Name'), n: fields.number('N') }),
  blocks: fields.blocks('Blocks', { hero: block('Hero', { heading: fields.text('Heading') }) }),
} satisfies Fields;

const valid = {
  title: 'T',
  summary: 's',
  date: '2026-11-24',
  at: '2026-11-24T10:00:00.000Z',
  link: 'https://x.dev',
  count: 3,
  on: true,
  kind: 'a',
  who: 'ann',
  more: ['a', 'b'],
  body: doc('hi'),
  tags: ['x'],
  cover: { url: '/api/mnml/media/a.png', alt: 'a' },
  seo: { title: 'S' },
  rows: [{ name: 'r', n: 1 }],
  blocks: [{ kind: 'hero', heading: 'H' }],
};

describe('fitDefaults', () => {
  it('gives what withDefaults gives for valid data, and reports nothing', () => {
    const seen: unknown[] = [];
    expect(fitDefaults(all, valid, (m) => seen.push(m))).toEqual(withDefaults(all, valid));
    expect(seen).toEqual([]);
  });

  it('fills missing fields, and reads a bare image URL and a dropped block kind like withDefaults', () => {
    const data = {
      title: 'T',
      cover: '/old.png',
      blocks: [
        { kind: 'gone', x: 1 },
        { kind: 'hero', heading: 'H' },
      ],
    };
    expect(fitDefaults(all, data)).toEqual(withDefaults(all, data));
  });

  it('empties null and blank values quietly', () => {
    const seen: unknown[] = [];
    const out = fitDefaults(all, { ...valid, summary: null, count: '', more: [], body: null }, (m) => seen.push(m));
    expect(seen).toEqual([]);
    expect(out).toMatchObject({ summary: '', count: null, more: [] });
    expect((out.body as { type: string }).type).toBe('doc');
  });

  it('replaces a value of the wrong kind with the empty value, and reports it', () => {
    const { data, mismatches } = reviewEntry(all, {
      ...valid,
      date: 12345,
      count: 'many',
      on: 'yes',
      kind: 'obsolete',
      more: 'not-a-list',
      body: 'just text',
      cover: 42,
      seo: 'oops',
      rows: 'x',
    });
    expect(data).toMatchObject({ date: null, count: null, on: false, kind: null, more: [], cover: null, rows: [] });
    expect(data.seo).toEqual({ title: '' });
    expect(mismatches.map((m) => m.path).sort()).toEqual(['body', 'count', 'cover', 'date', 'kind', 'more', 'on', 'rows', 'seo']);
    expect(mismatches.find((m) => m.path === 'on')).toMatchObject({ label: 'On', type: 'boolean', stored: 'yes', suggestion: { value: true } });
    expect(mismatches.find((m) => m.path === 'cover')?.suggestion).toBeUndefined();
  });

  it('finds a mismatch inside an array item, a block and a group, with the form path', () => {
    const { data, mismatches } = reviewEntry(all, {
      ...valid,
      seo: { title: { nope: 1 } },
      rows: [
        { name: 'ok', n: 1 },
        { name: 'bad', n: 'x' },
      ],
      blocks: [{ kind: 'hero', heading: 5 }],
    });
    expect(mismatches.map((m) => m.path)).toEqual(['seo.title', 'rows.1.n', 'blocks.0.heading']);
    expect((data.rows as { n: unknown }[])[1].n).toBeNull();
    expect(mismatches.find((m) => m.path === 'blocks.0.heading')?.suggestion).toEqual({ value: '5' });
  });

  it('drops a misfit in a hidden field without a report, as saving does', () => {
    const f = { mode: fields.select('Mode', ['a', 'b'] as const), extra: fields.number('Extra', { showIf: { mode: 'b' } }) } satisfies Fields;
    const seen: unknown[] = [];
    expect(fitDefaults(f, { mode: 'a', extra: 'text' }, (m) => seen.push(m))).toEqual({ mode: 'a', extra: null });
    expect(seen).toEqual([]);
    reviewEntry(f, { mode: 'b', extra: 'text' }).mismatches.forEach((m) => seen.push(m));
    expect(seen).toHaveLength(1);
  });

  it('copes with data that is not an object', () => {
    expect(fitDefaults(all, null).title).toBe('');
    expect(fitDefaults(all, 'string').title).toBe('');
  });
});

describe('docToText and docFromText', () => {
  const rich = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Some ' },
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' words.' },
        ],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
        ],
      },
    ],
  };
  it('reads the words: blank line between blocks, a line for each list item', () => {
    expect(docToText(rich)).toBe('Why\n\nSome bold words.\n\none\ntwo');
    expect(docToText(null)).toBe('');
    expect(docToText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
  it('makes a paragraph for each line', () => {
    expect(docFromText('a\n\nb')).toEqual(doc('a', 'b'));
    expect(docFromText('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});

describe('convertValue', () => {
  const f = all;
  it('rich text to text and textarea', () => {
    expect(convertValue(f.title, doc('One', 'Two'))).toEqual({ value: 'One Two' });
    expect(convertValue(f.summary, doc('One', 'Two'))).toEqual({ value: 'One\n\nTwo' });
  });
  it('text to rich text', () => {
    expect(convertValue(f.body, 'a\nb')).toEqual({ value: doc('a', 'b') });
    expect(convertValue(f.body, doc('x'))).toBeNull();
  });
  it('numbers, booleans and selects', () => {
    expect(convertValue(f.count, '1,250')).toEqual({ value: 1250 });
    expect(convertValue(f.count, 'many')).toBeNull();
    expect(convertValue(f.on, 'Yes')).toEqual({ value: true });
    expect(convertValue(f.on, 0)).toEqual({ value: false });
    expect(convertValue(f.on, 'maybe')).toBeNull();
    expect(convertValue(f.kind, 'B')).toEqual({ value: 'b' });
    expect(convertValue(f.kind, 'zzz')).toBeNull();
    expect(convertValue(fields.select('K', [{ value: 'blog', label: 'Blog Post' }] as const), 'blog post')).toEqual({ value: 'blog' });
  });
  it('dates and links', () => {
    expect(convertValue(f.date, '2026-11-24T10:30:00Z')).toEqual({ value: '2026-11-24' });
    expect(convertValue(f.date, Date.UTC(2026, 10, 24))).toEqual({ value: '2026-11-24' });
    expect(convertValue(f.date, 'last tuesday')).toBeNull();
    expect(convertValue(f.at, '2026-11-24T10:00:00Z')).toEqual({ value: '2026-11-24T10:00:00.000Z' });
    expect(convertValue(f.link, 'example.com/a')).toEqual({ value: 'https://example.com/a' });
    expect(convertValue(f.link, 'not a link')).toBeNull();
  });
  it('lists', () => {
    expect(convertValue(f.tags, 'a, b; a\nc')).toEqual({ value: ['a', 'b', 'c'] });
    expect(convertValue(f.more, 'one')).toEqual({ value: ['one'] });
  });
  it('has no conversion for containers, empty values or objects', () => {
    expect(convertValue(f.cover, 'x')).toBeNull();
    expect(convertValue(f.rows, 'x')).toBeNull();
    expect(convertValue(f.title, '  ')).toBeNull();
    expect(convertValue(f.title, { a: 1 })).toBeNull();
  });
});

describe('setIn', () => {
  it('sets a nested value without changing the input', () => {
    const data = { a: { b: [{ c: 1 }, { c: 2 }] }, x: 1 };
    const next = setIn(data, 'a.b.1.c', 9) as typeof data;
    expect(next.a.b[1].c).toBe(9);
    expect(data.a.b[1].c).toBe(2);
    expect(next.x).toBe(1);
    expect(next.a.b[0]).toBe(data.a.b[0]);
  });
  it('sets a top-level key, and creates missing parents', () => {
    expect(setIn({ a: 1 }, 'a', 2)).toEqual({ a: 2 });
    expect(setIn({}, 'g.k', 1)).toEqual({ g: { k: 1 } });
  });
});

describe('fieldLabelAt', () => {
  it('gives the label of the field at a path', () => {
    expect(fieldLabelAt(all, 'title')).toBe('Title');
    expect(fieldLabelAt(all, 'seo.title')).toBe('Title');
    expect(fieldLabelAt(all, 'rows.1.n')).toBe('N');
    expect(fieldLabelAt(all, 'blocks.0.heading')).toBe('Heading');
    expect(fieldLabelAt(all, 'cover')).toBe('Cover');
  });
  it('falls back to the path when there is no such field', () => {
    expect(fieldLabelAt(all, 'nope')).toBe('nope');
    expect(fieldLabelAt(all, 'seo.nope')).toBe('seo.nope');
  });
});

describe('lossNote', () => {
  const rich = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://x.dev' } }] },
        ],
      },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
    ],
  };
  it('lists what plain text cannot keep', () => {
    expect(lossNote(all.summary, rich)).toBe('Lost: 1 heading, 1 list, 1 link, bold, italic or other styling.');
    expect(lossNote(all.title, rich)).toBe('Lost: 1 heading, 1 list, 1 link, bold, italic or other styling. Paragraphs are joined on one line.');
  });
  it('says nothing for plain paragraphs, one paragraph, or another conversion', () => {
    expect(lossNote(all.summary, doc('a', 'b'))).toBeNull();
    expect(lossNote(all.title, doc('a'))).toBeNull();
    expect(lossNote(all.title, doc('a', 'b'))).toBe('Paragraphs are joined on one line.');
    expect(lossNote(all.count, '5')).toBeNull();
  });
  it('says the time is dropped when a date field takes a date and time', () => {
    expect(lossNote(all.date, '2026-11-24T10:30:00Z')).toBe('The time of day is dropped.');
    expect(lossNote(all.date, '2026-11-24')).toBeNull();
  });
  it('is part of a mismatch that has a suggestion', () => {
    const { mismatches } = reviewEntry(all, { ...valid, summary: rich });
    expect(mismatches[0]).toMatchObject({ path: 'summary', note: expect.stringContaining('1 heading') });
  });
});

describe('fieldAt', () => {
  it('finds the field at a path, through groups, array items and blocks', () => {
    expect(fieldAt(all, 'seo.title')?.type).toBe('text');
    expect(fieldAt(all, 'rows.2.n')?.type).toBe('number');
    expect(fieldAt(all, 'blocks.0.heading')?.label).toBe('Heading');
    expect(fieldAt(all, 'nope')).toBeUndefined();
  });
});
