import { describe, expect, it } from 'vite-plus/test';
import { block, emptyDoc, emptyValue, fields, isVisible, objectSchema, referenceTargets, slugify, slugSchema, withDefaults, type ShowIf } from './define.js';
import { displayText } from './text.js';

describe('emptyValue', () => {
  it('gives each field type its empty value', () => {
    expect(emptyValue(fields.text('T'))).toBe('');
    expect(emptyValue(fields.date('D'))).toBeNull();
    expect(emptyValue(fields.image('I'))).toBeNull();
    expect(emptyValue(fields.boolean('B'))).toBe(false);
    expect(emptyValue(fields.richtext('R'))).toEqual(emptyDoc);
    expect(emptyValue(fields.tags('T'))).toEqual([]);
    expect(emptyValue(fields.group('G', { a: fields.text('A'), b: fields.number('B') }))).toEqual({ a: '', b: null });
  });
});

describe('withDefaults', () => {
  const schema = {
    title: fields.text('Title'),
    cover: fields.image('Cover'),
    hero: fields.group('Hero', { headline: fields.text('Headline') }),
    links: fields.array('Links', { label: fields.text('Label'), href: fields.url('URL') }),
    sections: fields.blocks('Sections', { quote: block('Quote', { text: fields.textarea('Text') }) }),
  };

  it('fills fields missing from stored data', () => {
    expect(withDefaults(schema, { title: 'Hi' })).toEqual({ title: 'Hi', cover: null, hero: { headline: '' }, links: [], sections: [] });
  });

  it('treats non-object data as empty', () => {
    expect(withDefaults(schema, null).title).toBe('');
  });

  it('fills missing fields inside array items and groups', () => {
    const entry = withDefaults(schema, { hero: {}, links: [{ label: 'Docs' }] });
    expect(entry.hero).toEqual({ headline: '' });
    expect(entry.links).toEqual([{ label: 'Docs', href: null }]);
  });

  it('reads a stored image URL string as { url, alt }', () => {
    expect(withDefaults(schema, { cover: '/a.png' }).cover).toEqual({ url: '/a.png', alt: '' });
  });

  it('drops blocks whose kind is no longer in the config', () => {
    const entry = withDefaults(schema, { sections: [{ kind: 'quote' }, { kind: 'removed', text: 'x' }, 'junk'] });
    expect(entry.sections).toEqual([{ kind: 'quote', text: '' }]);
  });
});

describe('isVisible', () => {
  const f = (showIf: ShowIf) => fields.text('X', { showIf });

  it('shows fields without a condition', () => {
    expect(isVisible(fields.text('X'), {})).toBe(true);
  });

  it('matches values, lists, negations, ranges and emptiness', () => {
    expect(isVisible(f({ type: 'video' }), { type: 'video' })).toBe(true);
    expect(isVisible(f({ type: 'video' }), { type: 'image' })).toBe(false);
    expect(isVisible(f({ type: ['a', 'b'] }), { type: 'b' })).toBe(true);
    expect(isVisible(f({ type: { not: 'a' } }), { type: 'a' })).toBe(false);
    expect(isVisible(f({ n: { gte: 2, lt: 5 } }), { n: 4 })).toBe(true);
    expect(isVisible(f({ n: { gte: 2, lt: 5 } }), { n: 5 })).toBe(false);
    expect(isVisible(f({ n: { gt: 0 } }), { n: '3' })).toBe(false);
    expect(isVisible(f({ tags: { empty: true } }), { tags: [] })).toBe(true);
    expect(isVisible(f({ tags: { empty: false } }), { tags: ['x'] })).toBe(true);
  });

  it('requires every key to match', () => {
    expect(isVisible(f({ a: 1, b: 2 }), { a: 1, b: 3 })).toBe(false);
  });
});

describe('referenceTargets', () => {
  it('finds references in groups, arrays and blocks, once each', () => {
    const targets = referenceTargets({
      author: fields.reference('Author', 'authors'),
      meta: fields.group('Meta', { editor: fields.reference('Editor', 'authors') }),
      related: fields.array('Related', { post: fields.reference('Post', 'posts') }),
      body: fields.blocks('Body', { card: block('Card', { page: fields.reference('Page', 'pages') }) }),
    });
    expect(targets.sort()).toEqual(['authors', 'pages', 'posts']);
  });
});

describe('objectSchema', () => {
  it('requires required text and trims it', () => {
    const s = objectSchema({ title: fields.text('Title', { required: true }) });
    expect(s.safeParse({ title: '  ' }).success).toBe(false);
    expect(s.parse({ title: ' Hi ' })).toEqual({ title: 'Hi' });
  });

  it('turns blank optional inputs into null', () => {
    const s = objectSchema({ date: fields.date('Date'), url: fields.url('URL'), n: fields.number('N') });
    expect(s.parse({ date: '', url: ' ', n: '' })).toEqual({ date: null, url: null, n: null });
  });

  it('rejects unsafe URLs and malformed dates', () => {
    const s = objectSchema({ url: fields.url('URL'), date: fields.date('Date') });
    expect(s.safeParse({ url: 'javascript:alert(1)', date: null }).success).toBe(false);
    expect(s.safeParse({ url: null, date: '18/11/2026' }).success).toBe(false);
    expect(s.safeParse({ url: 'mailto:a@b.co', date: '2026-11-18' }).success).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(objectSchema({ title: fields.text('Title') }).safeParse({ title: '', extra: 1 }).success).toBe(false);
  });

  it('validates a showIf field only while it is shown, and resets an invalid hidden value', () => {
    const s = objectSchema({
      kind: fields.select('Kind', ['link', 'none']),
      href: fields.url('URL', { required: true, showIf: { kind: 'link' } }),
    });
    expect(s.safeParse({ kind: 'link', href: null }).success).toBe(false);
    expect(s.parse({ kind: 'none', href: 'https://kept.example' })).toEqual({ kind: 'none', href: 'https://kept.example' });
    expect(s.parse({ kind: 'none', href: 'not a url' })).toEqual({ kind: 'none', href: null });
  });

  it('validates blocks by kind', () => {
    const s = objectSchema({ body: fields.blocks('Body', { quote: block('Quote', { text: fields.text('Text', { required: true }) }) }) });
    expect(s.safeParse({ body: [{ kind: 'quote', text: 'Hi' }] }).success).toBe(true);
    expect(s.safeParse({ body: [{ kind: 'quote', text: '' }] }).success).toBe(false);
    expect(s.safeParse({ body: [{ kind: 'other', text: 'Hi' }] }).success).toBe(false);
  });
});

describe('slugs', () => {
  it('slugifies titles', () => {
    expect(slugify('  Héllo, Wörld!  ')).toBe('hello-world');
    expect(slugify('a'.repeat(150))).toHaveLength(100);
  });

  it('rejects reserved and malformed slugs', () => {
    expect(slugSchema.safeParse('new').success).toBe(false);
    expect(slugSchema.safeParse('singleton').success).toBe(false);
    expect(slugSchema.safeParse('Bad Slug').success).toBe(false);
    expect(slugSchema.safeParse('good-slug-2').success).toBe(true);
  });
});

describe('displayText', () => {
  it('shows strings, numbers and booleans, and nothing for other values', () => {
    expect(displayText('Hi')).toBe('Hi');
    expect(displayText(0)).toBe('0');
    expect(displayText(true)).toBe('true');
    expect(displayText(null)).toBe('');
    expect(displayText({ url: '/a.png' })).toBe('');
  });
});
