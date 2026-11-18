import { Node, type Editor } from '@tiptap/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vite-plus/test';
import { validateForm } from './admin/form-dialog.js';
import { fields } from './define.js';
import { defineEditor, type ToolContext } from './editor.js';
import { nodeAttributes, tools } from './editor-tools.js';
import { RichText } from './rich-text-render.js';

const videoFields = {
  url: fields.url('YouTube URL', { required: true }),
  title: fields.text('Title'),
  startAt: fields.number('Start at (seconds)'),
  autoplay: fields.boolean('Autoplay'),
  ratio: fields.select('Ratio', ['16:9', '4:3'] as const),
};

/** Stands in for an element when calling parseHTML. */
const el = (attrs: Record<string, string>) => ({ getAttribute: (n: string) => attrs[n] ?? null }) as unknown as HTMLElement;

describe('nodeAttributes', () => {
  const attrs = nodeAttributes(videoFields);

  it('starts each attribute at its field’s empty value', () => {
    expect(Object.fromEntries(Object.entries(attrs).map(([k, a]) => [k, a.default]))).toEqual({
      url: null,
      title: '',
      startAt: null,
      autoplay: false,
      ratio: null,
    });
  });

  it('renders values as data-* attributes, skipping empty ones', () => {
    const values = { url: 'https://youtu.be/x', title: '', startAt: 30, autoplay: true, ratio: null };
    const html = Object.values(attrs).map((a, i) => a.renderHTML?.({ [Object.keys(attrs)[i]]: Object.values(values)[i] }));
    expect(Object.assign({}, ...html)).toEqual({ 'data-url': 'https://youtu.be/x', 'data-start-at': '30', 'data-autoplay': 'true' });
  });

  it('parses data-* attributes back to typed values', () => {
    const parsed = (k: keyof typeof videoFields, a: Record<string, string>) => attrs[k].parseHTML?.(el(a));
    expect(parsed('startAt', { 'data-start-at': '30' })).toBe(30);
    expect(parsed('startAt', { 'data-start-at': 'abc' })).toBeNull();
    expect(parsed('autoplay', { 'data-autoplay': 'true' })).toBe(true);
    expect(parsed('autoplay', {})).toBe(false);
    expect(parsed('ratio', { 'data-ratio': '4:3' })).toBe('4:3');
    expect(parsed('ratio', { 'data-ratio': '1:1' })).toBeNull();
    expect(parsed('url', {})).toBeNull();
  });

  it('keeps the attributes when a node is rendered on the site', () => {
    const Video = Node.create({
      name: 'video',
      group: 'block',
      atom: true,
      addAttributes: () => nodeAttributes(videoFields),
      renderHTML: ({ HTMLAttributes }) => ['div', HTMLAttributes],
    });
    const html = renderToStaticMarkup(
      <RichText
        editor={defineEditor({ extensions: [Video] })}
        content={{ type: 'doc', content: [{ type: 'video', attrs: { url: 'https://youtu.be/x', startAt: 5 } }] }}
      />,
    );
    expect(html).toBe('<div><div data-url="https://youtu.be/x" data-start-at="5" data-autoplay="false"></div></div>');
  });
});

describe('tools.node', () => {
  const tool = tools.node({ name: 'video', label: 'Video', icon: null, group: 'insert', fields: videoFields, preview: (a) => a.url ?? '' });

  /** A fake editor that records what the tool's chain inserts. */
  const fakeEditor = () => {
    const inserted: unknown[] = [];
    const chain = { focus: () => chain, insertContent: (c: unknown) => (inserted.push(c), chain), run: () => true };
    return { editor: { chain: () => chain } as unknown as Editor, inserted };
  };
  const admin = (result: Record<string, unknown> | null) => ({ form: vi.fn(async () => result), confirm: vi.fn(), alert: vi.fn() }) as unknown as ToolContext;

  it('describes the node for the admin', () => {
    expect(tool.name).toBe('node:video');
    expect(tool.group).toBe('insert');
    expect(tool.nodeForm).toMatchObject({ name: 'video', label: 'Video', title: 'Video', fields: videoFields });
    expect(tool.nodeForm?.preview?.({ url: 'https://youtu.be/x' })).toBe('https://youtu.be/x');
  });

  it('asks for the values, then inserts the node with them', async () => {
    const { editor, inserted } = fakeEditor();
    const ctx = admin({ url: 'https://youtu.be/x', title: 'Demo' });
    await tool.run(editor, ctx);
    expect(ctx.form).toHaveBeenCalledWith({ title: 'Video', fields: videoFields, submitLabel: 'Insert' });
    expect(inserted).toEqual([{ type: 'video', attrs: { url: 'https://youtu.be/x', title: 'Demo' } }]);
  });

  it('inserts nothing when the form is cancelled', async () => {
    const { editor, inserted } = fakeEditor();
    await tool.run(editor, admin(null));
    expect(inserted).toEqual([]);
  });
});

describe('validateForm', () => {
  const values = { url: 'https://youtu.be/x', title: ' Demo ', startAt: '', autoplay: false, ratio: '' };

  it('returns the parsed values: trimmed text, blanks as null', () => {
    expect(validateForm(videoFields, values)).toEqual({
      ok: true,
      data: { url: 'https://youtu.be/x', title: 'Demo', startAt: null, autoplay: false, ratio: null },
    });
  });

  it('reports errors by field', () => {
    const r = validateForm(videoFields, { ...values, url: 'not a url', ratio: '1:1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['ratio', 'url']);
  });

  it('requires required fields', () => {
    const r = validateForm(videoFields, { ...values, url: '' });
    expect(r.ok).toBe(false);
  });
});
