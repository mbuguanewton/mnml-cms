import { describe, expect, it } from 'vite-plus/test';
import { collection, config, fields, singleton } from '../../schema/define.js';
import { searchEntry } from './entry.js';

const cms = config({
  settings: singleton({ label: 'Site settings', preview: '/', fields: { tagline: fields.text('Tagline') } }),
  posts: collection({ label: 'Posts', titleField: 'title', basePath: '/blog', fields: { title: fields.text('Title'), body: fields.textarea('Body') } }),
});

describe('searchEntry', () => {
  it('gives a collection entry its title, link and hashed passages', () => {
    const e = searchEntry(cms, 'posts', 'hello', { title: 'Hello', body: 'First.\n\nSecond.' })!;
    expect(e).toMatchObject({ id: 'posts/hello', key: 'posts', slug: 'hello', title: 'Hello', url: '/blog/hello' });
    expect(e.chunks).toMatchObject([{ field: 'body', idx: 0, text: 'First.\n\nSecond.' }]);
    expect(e.chunks[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a singleton a null slug, its label as title and its preview path', () => {
    expect(searchEntry(cms, 'settings', 'singleton', { tagline: 'Hi' })).toMatchObject({ id: 'settings/', slug: null, title: 'Site settings', url: '/' });
  });

  it('changes the hash with the text, the title or the link, and nothing else', () => {
    const hash = (data: unknown, slug = 'a') => searchEntry(cms, 'posts', slug, data)!.chunks[0].hash;
    const same = hash({ title: 'T', body: 'x' });
    expect(hash({ title: 'T', body: 'x' })).toBe(same);
    expect(hash({ title: 'T', body: 'y' })).not.toBe(same);
    expect(hash({ title: 'U', body: 'x' })).not.toBe(same);
    expect(hash({ title: 'T', body: 'x' }, 'b')).not.toBe(same);
  });

  it('falls back to the slug without a title, reads stale values as empty, and ignores unknown keys', () => {
    expect(searchEntry(cms, 'posts', 'untitled', { title: 5, body: { type: 'doc' } })).toMatchObject({ title: 'untitled', chunks: [] });
    expect(searchEntry(cms, 'nope', 'x', {})).toBeNull();
  });
});
