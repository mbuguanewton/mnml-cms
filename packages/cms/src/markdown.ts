// Rich text to and from Markdown, for agents (the MCP server) and import scripts. Framework-free.
// Uses the default editor extensions (StarterKit + Image): a site's own extensions live in a client component the
// server can't see, so their nodes (references, nodes with a form, tables) stay Tiptap JSON.
import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import type { Fields } from './define.js';
import { extensions } from './rich-text.js';

let manager: MarkdownManager | undefined;
const md = () => (manager ??= new MarkdownManager({ extensions }));

/** Node and mark types Markdown can express with the default extensions. */
const KNOWN = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'image',
]);

type Token = { type: string; tokens?: Token[]; items?: Token[] };

/** Markdown token types that would be dropped silently, so converting refuses them instead. */
function unsupported(tokens: Token[], out = new Set<string>()): Set<string> {
  for (const t of tokens) {
    if (t.type === 'table') out.add('tables');
    else if (t.type === 'html') out.add('raw HTML');
    unsupported(t.tokens ?? [], out);
    unsupported(t.items ?? [], out);
  }
  return out;
}

/**
 * A Markdown string as a rich text value (Tiptap JSON). Supports headings, bold, italic, strike, inline code, links,
 * lists, blockquotes, code blocks, images, horizontal rules and line breaks. Throws on tables and raw HTML, which
 * can't be kept: write those as Tiptap JSON.
 */
export function markdownToRichText(markdown: string): JSONContent {
  const bad = unsupported(md().instance.lexer(markdown) as Token[]);
  if (bad.size) throw new Error(`Markdown ${[...bad].join(' and ')} aren't supported in rich text. Use Tiptap JSON for those.`);
  const doc = md().parse(markdown);
  return doc.content?.length ? doc : { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * A rich text value as Markdown. Nodes Markdown can't express (references, nodes with a form, tables) come out as
 * `<!-- mnml:<type> -->` and `lossy` is true: writing that Markdown back would lose them.
 */
export function richTextToMarkdown(doc: JSONContent | null | undefined): { markdown: string; lossy: boolean } {
  let lossy = false;
  // Swap unknown nodes for a text marker, so they show up instead of vanishing.
  const clean = (node: JSONContent, inline: boolean): JSONContent => {
    if (!KNOWN.has(node.type ?? '')) {
      lossy = true;
      const marker: JSONContent = { type: 'text', text: `<!-- mnml:${node.type} -->` };
      return inline ? marker : { type: 'paragraph', content: [marker] };
    }
    if (!node.content) return node;
    const childInline = node.type === 'paragraph' || node.type === 'heading';
    return { ...node, content: node.content.map((c) => clean(c, childInline)) };
  };
  if (!doc || doc.type !== 'doc') return { markdown: '', lossy: false };
  const markdown = md()
    .serialize(clean(doc, false))
    // The serializer escapes the marker's angle brackets; put them back.
    .replace(/\\?<!-- mnml:([\w-]+) --\\?>/g, '<!-- mnml:$1 -->')
    .replace(/&lt;!-- mnml:([\w-]+) --&gt;/g, '<!-- mnml:$1 -->')
    .trim();
  return { markdown, lossy };
}

/**
 * Converts every Markdown string in `richtext` fields of `data` (also inside groups, arrays and blocks) to Tiptap JSON.
 * Other values pass through. Errors are collected by field path, e.g. `{ 'body': 'Markdown tables aren't supported…' }`.
 */
export function markdownFields(fields: Fields, data: unknown, at = ''): { data: unknown; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { data, errors };
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  const nested = (f: Fields, v: unknown, path: string) => {
    const r = markdownFields(f, v, path);
    Object.assign(errors, r.errors);
    return r.data;
  };
  for (const [k, v] of Object.entries(out)) {
    const f = Object.hasOwn(fields, k) ? fields[k] : undefined;
    const path = at ? `${at}.${k}` : k;
    if (!f) continue;
    if (f.type === 'richtext' && typeof v === 'string') {
      try {
        out[k] = markdownToRichText(v);
      } catch (e) {
        errors[path] = (e as Error).message;
      }
    } else if (f.type === 'group') out[k] = nested(f.fields, v, path);
    else if (f.type === 'array' && Array.isArray(v)) out[k] = v.map((item, i) => nested(f.fields, item, `${path}.${i}`));
    else if (f.type === 'blocks' && Array.isArray(v))
      out[k] = v.map((item, i) => {
        const kind = (item as { kind?: unknown } | null)?.kind;
        return typeof kind === 'string' && Object.hasOwn(f.blocks, kind) ? nested(f.blocks[kind].fields, item, `${path}.${i}`) : item;
      });
  }
  return { data: out, errors };
}

/** Every rich text value in `data` as Markdown (also inside groups, arrays and blocks). `lossy` if any lost nodes. */
export function richTextFieldsToMarkdown(fields: Fields, data: unknown): { data: unknown; lossy: boolean } {
  let lossy = false;
  const walk = (f: Fields, v: unknown): unknown => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
    for (const [k, field] of Object.entries(f)) {
      const x = out[k];
      if (field.type === 'richtext' && x && typeof x === 'object') {
        const r = richTextToMarkdown(x as JSONContent);
        lossy ||= r.lossy;
        out[k] = r.markdown;
      } else if (field.type === 'group') out[k] = walk(field.fields, x);
      else if (field.type === 'array' && Array.isArray(x)) out[k] = x.map((item) => walk(field.fields, item));
      else if (field.type === 'blocks' && Array.isArray(x))
        out[k] = x.map((item) => {
          const kind = (item as { kind?: unknown } | null)?.kind;
          return typeof kind === 'string' && Object.hasOwn(field.blocks, kind) ? walk(field.blocks[kind].fields, item) : item;
        });
    }
    return out;
  };
  return { data: walk(fields, data), lossy };
}
