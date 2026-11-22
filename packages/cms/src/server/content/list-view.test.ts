import { describe, expect, it } from 'vite-plus/test';
import { listView, parsePage } from './list-view.js';

const items = Array.from({ length: 30 }, (_, i) => ({ slug: `post-${i + 1}`, title: i === 4 ? 'Hello World' : `Post ${i + 1}` }));
const title = (i: (typeof items)[number]) => i.title;

describe('listView', () => {
  it('pages 25 at a time', () => {
    expect(listView(items, { title })).toMatchObject({ total: 30, page: 1, pages: 2, from: 1, to: 25 });
    const two = listView(items, { title, page: 2 });
    expect(two).toMatchObject({ page: 2, from: 26, to: 30 });
    expect(two.items.map((i) => i.slug)).toEqual(['post-26', 'post-27', 'post-28', 'post-29', 'post-30']);
  });

  it('clamps a page past the end to the last one', () => {
    expect(listView(items, { title, page: 9 })).toMatchObject({ page: 2, from: 26 });
  });

  it('searches the title and the slug, case-insensitive', () => {
    expect(listView(items, { title, q: 'hello' }).items.map((i) => i.slug)).toEqual(['post-5']);
    expect(listView(items, { title, q: ' POST-30 ' }).items.map((i) => i.slug)).toEqual(['post-30']);
    expect(listView(items, { title, q: 'post-1' }).total).toBe(11);
  });

  it('reports an empty result', () => {
    expect(listView(items, { title, q: 'nothing' })).toEqual({ items: [], total: 0, page: 1, pages: 1, from: 0, to: 0 });
    expect(listView([], { title })).toMatchObject({ total: 0, pages: 1, from: 0 });
  });
});

describe('parsePage', () => {
  it('reads whole numbers from 1 up, else 1', () => {
    expect(parsePage('3')).toBe(3);
    for (const v of [undefined, '', '0', '-2', 'abc', ['2']]) expect(parsePage(v)).toBe(1);
  });
});
