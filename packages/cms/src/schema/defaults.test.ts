import { describe, expect, it, vi } from 'vite-plus/test';
import { block, collection, fields, initialValues, plainDef, withDefaults } from './define.js';

describe('initialValues', () => {
  it('uses each field’s default, or its empty value', () => {
    const f = {
      title: fields.text('Title'),
      pageType: fields.select('Type', ['page', 'post'] as const, { default: 'page' }),
      featured: fields.boolean('Featured', { default: true }),
      count: fields.number('Count', { default: 3 }),
      tags: fields.tags('Tags', { default: ['news'] }),
      cover: fields.image('Cover'),
    };
    expect(initialValues(f)).toEqual({ title: '', pageType: 'page', featured: true, count: 3, tags: ['news'], cover: null });
  });

  it('calls function defaults when something is created, not when the field is defined', () => {
    const now = vi.fn(() => '2026-11-18');
    const f = { date: fields.date('Date', { default: now }) };
    expect(now).not.toHaveBeenCalled();
    expect(initialValues(f)).toEqual({ date: '2026-11-18' });
    initialValues(f);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('fills groups from their fields’ defaults', () => {
    const f = { hero: fields.group('Hero', { eyebrow: fields.text('Eyebrow', { default: 'New' }), title: fields.text('Title') }) };
    expect(initialValues(f)).toEqual({ hero: { eyebrow: 'New', title: '' } });
  });

  it('works on references', () => {
    expect(initialValues({ related: fields.references('Related', 'posts', { default: ['intro'] }) })).toEqual({ related: ['intro'] });
    // @ts-expect-error a references default is a list of slugs
    fields.references('Related', 'posts', { default: 'intro' });
  });

  it('gives each creation its own copy of a list default', () => {
    const f = { tags: fields.tags('Tags', { default: ['a'] }) };
    const one = initialValues(f);
    one.tags.push('b');
    expect(initialValues(f).tags).toEqual(['a']);
  });
});

describe('reads never apply defaults', () => {
  it('fills missing fields with their empty value', () => {
    const f = { pageType: fields.select('Type', ['page', 'post'] as const, { default: 'page' }), featured: fields.boolean('Featured', { default: true }) };
    expect(withDefaults(f, {})).toEqual({ pageType: null, featured: false });
    expect(withDefaults(f, { pageType: 'post' })).toEqual({ pageType: 'post', featured: false });
  });
});

describe('plainDef', () => {
  const posts = collection({
    label: 'Posts',
    titleField: 'title',
    basePath: '/posts',
    fields: {
      title: fields.text('Title'),
      date: fields.date('Date', { default: () => '2026-11-18' }),
      links: fields.array('Links', { label: fields.text('Label', { default: () => 'Read more' }) }),
      body: fields.blocks('Body', { stats: block('Stats', { count: fields.number('Count', { default: () => 3 }) }) }),
    },
  });

  it('replaces function defaults with their value, in arrays and blocks too', () => {
    const plain = plainDef(posts);
    expect(plain.fields.date.default).toBe('2026-11-18');
    expect(plain.fields.links.fields.label.default).toBe('Read more');
    expect(plain.fields.body.blocks.stats.fields.count.default).toBe(3);
  });

  it('leaves no functions behind (the definition goes to the browser)', () => {
    const hasFunction = (v: unknown): boolean => typeof v === 'function' || (!!v && typeof v === 'object' && Object.values(v).some(hasFunction));
    expect(hasFunction(plainDef(posts))).toBe(false);
  });

  it('lets new array items and blocks start with those values', () => {
    const plain = plainDef(posts);
    expect(initialValues(plain.fields.links.fields)).toEqual({ label: 'Read more' });
    expect(initialValues(plain.fields.body.blocks.stats.fields)).toEqual({ count: 3 });
  });
});

describe('default types', () => {
  it('are checked per field type', () => {
    // @ts-expect-error a select's default must be one of its options
    fields.select('Type', ['page', 'post'] as const, { default: 'other' });
    // @ts-expect-error a boolean's default is a boolean
    fields.boolean('Featured', { default: 'yes' });
    // @ts-expect-error a number's default is a number
    fields.number('Count', { default: '3' });
    // @ts-expect-error a function default returns the field's type
    fields.text('Title', { default: () => 1 });
    // @ts-expect-error images have no default
    fields.image('Cover', { default: { url: '/a.png', alt: '' } });
    expect(true).toBe(true);
  });
});
