import { describe, expect, it } from 'vite-plus/test';
import { block, fields } from './define.js';
import { markdownFields, markdownToRichText, richTextFieldsToMarkdown, richTextToMarkdown } from './markdown.js';

const types = (doc: { content?: { type?: string }[] }) => doc.content?.map((n) => n.type);

describe('markdownToRichText', () => {
  it('converts the supported Markdown', () => {
    const doc = markdownToRichText(
      '## Title\n\nSome **bold**, *italic*, ~~gone~~, `code` and a [link](https://x.com).\n\n- one\n- two\n\n1. a\n\n> quote\n\n```ts\nconst a = 1;\n```\n\n![Alt](https://x.com/a.png)\n\n---\n',
    );
    expect(types(doc)).toEqual(['heading', 'paragraph', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'image', 'horizontalRule']);
    expect(doc.content?.[0]).toMatchObject({ attrs: { level: 2 } });
    const marks = doc.content?.[1].content?.flatMap((t) => t.marks?.map((m) => m.type) ?? []);
    expect(marks).toEqual(['bold', 'italic', 'strike', 'code', 'link']);
    expect(doc.content?.[6]).toMatchObject({ attrs: { src: 'https://x.com/a.png', alt: 'Alt' } });
  });

  it('gives an empty doc for empty Markdown', () => {
    expect(markdownToRichText('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('refuses tables and raw HTML instead of dropping them', () => {
    expect(() => markdownToRichText('| a | b |\n|---|---|\n| 1 | 2 |')).toThrow('tables');
    expect(() => markdownToRichText('<div>hi</div>')).toThrow('raw HTML');
    expect(() => markdownToRichText('a < b and b > c')).not.toThrow();
  });
});

describe('richTextToMarkdown', () => {
  it('round-trips supported content', () => {
    const md = '## Title\n\nSome **bold** and a [link](https://x.com).\n\n- one\n- two';
    expect(richTextToMarkdown(markdownToRichText(md))).toEqual({ markdown: md, lossy: false });
  });

  it('marks nodes Markdown cannot express', () => {
    const r = richTextToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'entryReference', attrs: { slug: 'x' } },
          ],
        },
        { type: 'callout', attrs: { tone: 'info' } },
      ],
    });
    expect(r.lossy).toBe(true);
    expect(r.markdown).toContain('See <!-- mnml:entryReference -->');
    expect(r.markdown).toContain('<!-- mnml:callout -->');
  });

  it('handles empty values', () => {
    expect(richTextToMarkdown(null)).toEqual({ markdown: '', lossy: false });
  });
});

describe('markdownFields', () => {
  const f = {
    body: fields.richtext('Body'),
    title: fields.text('Title'),
    hero: fields.group('Hero', { intro: fields.richtext('Intro') }),
    faq: fields.array('FAQ', { answer: fields.richtext('Answer') }),
    sections: fields.blocks('Sections', { text: block('Text', { content: fields.richtext('Content') }) }),
  };

  it('converts Markdown strings in rich text fields, nested ones too', () => {
    const r = markdownFields(f, {
      body: '**Hi**',
      title: '**not rich text**',
      hero: { intro: 'Intro' },
      faq: [{ answer: 'Yes' }],
      sections: [{ kind: 'text', content: '# Head' }],
    });
    expect(r.errors).toEqual({});
    expect(r.data).toMatchObject({
      body: { type: 'doc' },
      title: '**not rich text**',
      hero: { intro: { type: 'doc' } },
      faq: [{ answer: { type: 'doc' } }],
      sections: [{ kind: 'text', content: { type: 'doc' } }],
    });
  });

  it('leaves Tiptap JSON alone and reports errors by path', () => {
    const json = { type: 'doc', content: [{ type: 'paragraph' }] };
    const r = markdownFields(f, { body: json, faq: [{ answer: '| a |\n|---|\n| 1 |' }] });
    expect((r.data as Record<string, unknown>).body).toBe(json);
    expect(Object.keys(r.errors)).toEqual(['faq.0.answer']);
  });

  it('turns rich text back into Markdown', () => {
    const { data } = markdownFields(f, { body: '**Hi**', faq: [{ answer: 'Yes' }] });
    expect(richTextFieldsToMarkdown(f, data)).toEqual({ data: { body: '**Hi**', faq: [{ answer: 'Yes' }] }, lossy: false });
  });
});
