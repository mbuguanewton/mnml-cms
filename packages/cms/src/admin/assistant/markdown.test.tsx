import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { uiProvider } from '../ui/context.js';
import { Markdown, parseBlocks, safeHref } from './markdown.js';

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe('parseBlocks', () => {
  it('reads paragraphs, lists, headings, quotes, code and rules', () => {
    expect(parseBlocks('Intro\nstill intro\n\n* a\n*   b\n\n1. one\n2) two\n\n## Head\n> quoted\n---\n```js\nlet x;\n```')).toEqual([
      { type: 'p', text: 'Intro\nstill intro' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'ol', items: ['one', 'two'] },
      { type: 'h', text: 'Head' },
      { type: 'quote', text: 'quoted' },
      { type: 'hr' },
      { type: 'code', text: 'let x;' },
    ]);
  });

  it('keeps an indented line with the list item above it', () => {
    expect(parseBlocks('- a\n  more of a\n- b')).toEqual([{ type: 'ul', items: ['a\nmore of a', 'b'] }]);
  });

  it('shows an unfinished code fence as code while the reply streams', () => {
    expect(parseBlocks('```\nlet x')).toEqual([{ type: 'code', text: 'let x' }]);
  });
});

describe('Markdown', () => {
  it('renders the reply from the screenshot: bullets with bold names', () => {
    const out = html('The site has several types of content:\n\n*   **Settings**: General site settings.\n*   **Posts**: Blog posts.');
    expect(out).toContain('<ul');
    expect(out).toContain('<strong>Settings</strong>: General site settings.');
    expect(out).not.toContain('**');
  });

  it('renders bold, italic and inline code', () => {
    const out = html('a **b** and *c* and `d` and _e_');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>c</em>');
    expect(out).toContain('<em>e</em>');
    expect(out).toContain('>d</code>');
  });

  it('does not turn snake_case words or a lone asterisk into italics', () => {
    expect(html('use my_field_name here')).toContain('my_field_name');
    expect(html('2 * 3 * 4')).not.toContain('<em>');
  });

  it('leaves an unfinished **bold as written', () => {
    expect(html('this is **bo')).toContain('**bo');
  });

  it('never lets a model inject markup', () => {
    const out = html('<img src=x onerror=alert(1)> <script>alert(1)</script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;img');
  });

  it('links http, mailto and site paths, and shows anything else as text', () => {
    expect(html('[a](https://example.com)')).toContain('href="https://example.com"');
    expect(html('[a](/posts/x)')).toContain('href="/posts/x"');
    const bad = html('[a](javascript:alert(1))');
    expect(bad).not.toContain('<a');
    expect(bad).toContain('[a](javascript:alert(1))');
    expect(safeHref('//evil.com')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
  });

  it('marks links to open in a new tab safely', () => {
    expect(html('[a](https://example.com)')).toContain('rel="noopener noreferrer"');
  });
});

describe('the Markdown slot', () => {
  it("renders the site's component with the reply's text", () => {
    const Ui = uiProvider({ Markdown: ({ text }) => <article data-site-markdown>{text.toUpperCase()}</article> });
    expect(
      renderToStaticMarkup(
        <Ui>
          <Markdown text="**hi**" />
        </Ui>,
      ),
    ).toBe('<article data-site-markdown="true">**HI**</article>');
  });

  it('gives a site component that wraps the built-in renderer the built-in, not itself', () => {
    const Ui = uiProvider({
      Markdown: (p) => (
        <section data-wrapped>
          <Markdown {...p} />
        </section>
      ),
    });
    const out = renderToStaticMarkup(
      <Ui>
        <Markdown text="a **b**" />
      </Ui>,
    );
    expect(out).toContain('<section data-wrapped="true">');
    expect(out).toContain('<strong>b</strong>');
  });
});
