import { readFileSync } from 'node:fs';
import type { Editor, JSONContent } from '@tiptap/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vite-plus/test';
import { defineEditor, type ToolContext } from './config.js';
import { RichText } from '../rich-text/render.js';
import { tables } from './tables.js';

const text = (t: string): JSONContent => ({ type: 'text', text: t });
const cell = (type: 'tableHeader' | 'tableCell', t: string): JSONContent => ({ type, content: [{ type: 'paragraph', content: [text(t)] }] });
const table: JSONContent = {
  type: 'table',
  content: [
    { type: 'tableRow', content: [cell('tableHeader', 'Plan'), cell('tableHeader', 'Price')] },
    { type: 'tableRow', content: [cell('tableCell', 'Basic'), cell('tableCell', '£5')] },
  ],
};

describe('tables in <RichText>', () => {
  it('render as a semantic table with header and body cells', () => {
    const html = renderToStaticMarkup(<RichText editor={defineEditor({ extensions: tables.extensions })} content={{ type: 'doc', content: [table] }} />);
    expect(html).toContain('<table');
    expect(html).toMatch(/<th[^>]*><p>Plan<\/p><\/th><th[^>]*><p>Price<\/p><\/th>/);
    expect(html).toMatch(/<td[^>]*><p>Basic<\/p><\/td><td[^>]*><p>£5<\/p><\/td>/);
    expect(html).not.toContain('resize');
  });
});

describe('table tools', () => {
  /** A fake editor recording chained commands; `inTable` decides isActive('table'). */
  const fakeEditor = (inTable: boolean) => {
    const calls: [string, unknown[]][] = [];
    const chain: Record<string, (...a: unknown[]) => unknown> = new Proxy(
      {},
      {
        get:
          (_t, name: string) =>
          (...args: unknown[]) =>
            name === 'run' ? true : (calls.push([name, args]), chain),
      },
    );
    return { editor: { chain: () => chain, isActive: (n: string) => inTable && n === 'table' } as unknown as Editor, calls };
  };
  const admin = { form: vi.fn(), confirm: vi.fn(), alert: vi.fn() } as unknown as ToolContext;
  const byName = (n: string) => tables.tools.find((t) => t.name === n)!;

  it('inserts a 3×3 table with a header row', () => {
    const { editor, calls } = fakeEditor(false);
    byName('table').run(editor, admin);
    expect(calls).toEqual([
      ['focus', []],
      ['insertTable', [{ rows: 3, cols: 3, withHeaderRow: true }]],
    ]);
    expect(byName('table').group).toBe('insert');
  });

  it('puts the row and column controls in the toolbar above the table', () => {
    const controls = tables.tools.filter((t) => t.name !== 'table');
    expect(controls.map((t) => t.name)).toEqual(['tableAddRow', 'tableDeleteRow', 'tableAddColumn', 'tableDeleteColumn', 'tableHeaderRow', 'tableDelete']);
    expect(controls.every((t) => t.context === 'table')).toBe(true);
    expect(byName('table').context).toBeUndefined();
  });

  it('runs the matching table commands', () => {
    const expected: Record<string, string> = {
      tableAddRow: 'addRowAfter',
      tableDeleteRow: 'deleteRow',
      tableAddColumn: 'addColumnAfter',
      tableDeleteColumn: 'deleteColumn',
      tableHeaderRow: 'toggleHeaderRow',
      tableDelete: 'deleteTable',
    };
    for (const [name, command] of Object.entries(expected)) {
      const { editor, calls } = fakeEditor(true);
      byName(name).run(editor, admin);
      expect(
        calls.map(([c]) => c),
        name,
      ).toEqual(['focus', command]);
    }
  });

  it('are not part of the shared editor entry', () => {
    for (const file of ['entry.ts', 'tools.tsx', 'config.ts', '../rich-text/extensions.ts']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8'), file).not.toContain('extension-table');
    }
  });
});

describe('toolbar order', () => {
  it('puts ready-made tools before the site’s own in each group, keeping config order', async () => {
    const { orderTools } = await import('./config.js');
    const { tools } = await import('./tools.js');
    const mine = (name: string) => ({ name, label: name, icon: null, group: 'insert' as const, run: () => {} });
    const ordered = orderTools([mine('youtube'), mine('blockLink'), ...tables.tools, tools.horizontalRule]).map((t) => t.name);
    expect(ordered.slice(0, 2)).toEqual(['table', 'tableAddRow']);
    expect(ordered.indexOf('horizontalRule')).toBeLessThan(ordered.indexOf('youtube'));
    expect(ordered.slice(-2)).toEqual(['youtube', 'blockLink']);
  });

  it('marks the package’s tools as built in, and not tools.node / tools.reference', async () => {
    const { tools } = await import('./tools.js');
    expect([tools.underline, tools.strike, tools.horizontalRule, ...tables.tools].every((t) => t.builtIn)).toBe(true);
    expect(tools.reference({ name: 'x', label: 'X', icon: null, collection: 'posts' }).builtIn).toBeUndefined();
  });
});
