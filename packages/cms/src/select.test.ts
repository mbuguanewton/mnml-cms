import { describe, expect, it } from 'vite-plus/test';
import { fields, initialValues, isVisible, objectSchema, selectLabel, type EntryOf } from './define.js';

describe('select options with labels', () => {
  const type = fields.select('Type', ['page', { value: 'blog', label: 'Blog Post' }, { value: 'case', label: 'Case study' }] as const);

  it('keeps the values as options and the labels alongside', () => {
    expect(type.options).toEqual(['page', 'blog', 'case']);
    expect(type.optionLabels).toEqual({ blog: 'Blog Post', case: 'Case study' });
  });

  it('adds no labels for plain string options', () => {
    expect(fields.select('Size', ['s', 'm'] as const)).toEqual({ type: 'select', label: 'Size', options: ['s', 'm'] });
  });

  it('infers the value union from both forms', () => {
    const value: EntryOf<{ type: typeof type }>['type'] = 'blog';
    expect(value).toBe('blog');
    // @ts-expect-error a label is not a value
    const wrong: EntryOf<{ type: typeof type }>['type'] = 'Blog Post';
    expect(wrong).toBe('Blog Post');
  });

  it('takes a default that is a value, not a label', () => {
    expect(initialValues({ t: fields.select('Type', [{ value: 'blog', label: 'Blog Post' }] as const, { default: 'blog' }) })).toEqual({ t: 'blog' });
    // @ts-expect-error the default must be a value
    fields.select('Type', [{ value: 'blog', label: 'Blog Post' }] as const, { default: 'Blog Post' });
  });

  it('validates and stores values', () => {
    const s = objectSchema({ type });
    expect(s.parse({ type: 'blog' })).toEqual({ type: 'blog' });
    expect(s.safeParse({ type: 'Blog Post' }).success).toBe(false);
    expect(s.parse({ type: '' })).toEqual({ type: null });
  });

  it('matches showIf conditions against values', () => {
    const f = fields.text('Client', { showIf: { type: 'case' } });
    expect(isVisible(f, { type: 'case' })).toBe(true);
    expect(isVisible(f, { type: 'Case study' })).toBe(false);
  });

  it('rejects a value listed twice', () => {
    expect(() => fields.select('Type', ['a', { value: 'a', label: 'A' }])).toThrow(/'a' is listed twice/);
  });

  it('gives the label for showing a value on the site', () => {
    expect(selectLabel(type, 'blog')).toBe('Blog Post');
    expect(selectLabel(type, 'page')).toBe('page');
    expect(selectLabel(type, null)).toBeNull();
  });
});
