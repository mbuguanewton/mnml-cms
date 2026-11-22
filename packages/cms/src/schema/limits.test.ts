import { describe, expect, it } from 'vite-plus/test';
import { filterOptions } from '../admin/entry/entry-combobox.js';
import { block, fields, objectSchema } from './define.js';

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('array limits', () => {
  const s = objectSchema({ links: fields.array('Links', { label: fields.text('Label') }, { min: 1, max: 2 }) });
  const item = { label: 'x' };

  it('counts items against min and max, reporting on the field itself', () => {
    expect(issues(s.safeParse({ links: [] }))).toEqual(['links: Add at least 1 item']);
    expect(issues(s.safeParse({ links: [item, item, item] }))).toEqual(['links: Add at most 2 items']);
    expect(s.safeParse({ links: [item, item] }).success).toBe(true);
  });

  it('treats required as at least one', () => {
    const r = objectSchema({ links: fields.array('Links', { label: fields.text('Label') }, { required: true }) });
    expect(issues(r.safeParse({ links: [] }))).toEqual(['links: Add at least 1 item']);
  });

  it('has no limits unless set', () => {
    expect(objectSchema({ links: fields.array('Links', { label: fields.text('Label') }) }).safeParse({ links: [] }).success).toBe(true);
  });
});

describe('blocks limits', () => {
  const s = objectSchema({ body: fields.blocks('Body', { text: block('Text', { t: fields.text('T') }) }, { min: 2, max: 3 }) });
  const t = { kind: 'text', t: '' };

  it('counts blocks against min and max', () => {
    expect(issues(s.safeParse({ body: [t] }))).toEqual(['body: Add at least 2 items']);
    expect(issues(s.safeParse({ body: [t, t, t, t] }))).toEqual(['body: Add at most 3 items']);
    expect(s.safeParse({ body: [t, t] }).success).toBe(true);
  });

  it('skips the check while the field is hidden by showIf', () => {
    const c = objectSchema({
      layout: fields.select('Layout', ['sections', 'plain'] as const),
      body: fields.blocks('Body', { text: block('Text', { t: fields.text('T') }) }, { min: 1, showIf: { layout: 'sections' } }),
    });
    expect(c.safeParse({ layout: 'plain', body: [] }).success).toBe(true);
    expect(issues(c.safeParse({ layout: 'sections', body: [] }))).toEqual(['body: Add at least 1 item']);
  });
});

describe('references limits (unchanged)', () => {
  it('still speaks of entries', () => {
    const s = objectSchema({ r: fields.references('R', 'posts', { min: 2 }) });
    expect(issues(s.safeParse({ r: ['a'] }))).toEqual(['r: Pick at least 2 entries']);
  });
});

describe('filterOptions', () => {
  const options = [
    { slug: 'one-table', label: 'One table is enough' },
    { slug: 'content-model', label: 'Writing a content model' },
  ];

  it('matches the title or the slug, ignoring case and outer spaces', () => {
    expect(filterOptions(options, '  TABLE ').map((o) => o.slug)).toEqual(['one-table']);
    expect(filterOptions(options, 'content-mod').map((o) => o.slug)).toEqual(['content-model']);
    expect(filterOptions(options, 'nothing like it')).toEqual([]);
  });

  it('returns everything for an empty query', () => {
    expect(filterOptions(options, '   ')).toEqual(options);
  });
});
