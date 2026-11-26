import { describe, expect, it } from 'vite-plus/test';
import { block, collection, fields, singleton } from '../../schema/define.js';
import { chunkEntry, MAX_CHUNK, splitText } from './chunk.js';

const doc = (...paras: string[]) => ({ type: 'doc', content: paras.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) });

const posts = collection({
  label: 'Posts',
  titleField: 'title',
  basePath: '/posts',
  fields: {
    title: fields.text('Title'),
    views: fields.number('Views'),
    body: fields.richtext('Body'),
    tags: fields.tags('Tags'),
    seo: fields.group('SEO', { description: fields.textarea('Description') }),
    faq: fields.array('FAQ', { q: fields.text('Q'), a: fields.textarea('A') }),
    sections: fields.blocks('Sections', { text: block('Text', { copy: fields.textarea('Copy') }) }),
  },
});

describe('chunkEntry', () => {
  it('reads prose from every field kind and skips the title and non-prose fields', () => {
    const chunks = chunkEntry(posts, {
      title: 'Hello',
      views: 12,
      body: doc('First paragraph.', 'Second.'),
      tags: ['a', 'b'],
      seo: { description: 'Meta text' },
      faq: [{ q: 'Why?', a: 'Because.' }],
      sections: [
        { kind: 'text', copy: 'In a block' },
        { kind: 'gone', copy: 'dropped' },
      ],
    });
    expect(chunks.map((c) => c.field)).toEqual(['body', 'tags', 'seo', 'faq', 'sections']);
    expect(chunks[0].text).toBe('First paragraph.\n\nSecond.');
    expect(chunks[3].text).toBe('Why?\n\nBecause.');
    expect(chunks[4].text).toBe('In a block');
    expect(chunks.map((c) => c.idx)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps the title field of a singleton, and returns nothing for empty or bad data', () => {
    const settings = singleton({ label: 'Settings', fields: { title: fields.text('Title') } });
    expect(chunkEntry(settings, { title: 'Site' }).map((c) => c.text)).toEqual(['Site']);
    expect(chunkEntry(posts, { title: 'x' })).toEqual([]);
    expect(chunkEntry(posts, null)).toEqual([]);
  });
});

describe('splitText', () => {
  it('packs short paragraphs together', () => {
    expect(splitText('a\n\nb\n\nc', 100)).toEqual(['a\n\nb\n\nc']);
  });
  it('splits long text at sentences and never exceeds the limit', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const parts = splitText(text, 200);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 200)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });
  it('hard-splits a run with no break', () => {
    const parts = splitText('x'.repeat(MAX_CHUNK * 2 + 5));
    expect(parts.map((p) => p.length)).toEqual([MAX_CHUNK, MAX_CHUNK, 5]);
  });
});
