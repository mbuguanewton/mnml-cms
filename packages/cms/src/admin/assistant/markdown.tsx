'use client';

import type { ReactNode } from 'react';
import { slotted } from '../ui/context.js';
import type { MarkdownProps } from '../ui/slots.js';

// A small Markdown renderer for the assistant's replies: paragraphs, headings, lists, quotes, code, bold, italic,
// inline code and links. It builds React elements (never HTML strings), so nothing a model writes can inject markup.
// A reply is rendered while it streams, so an unfinished `**bold` or code fence just shows as written until it closes.

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'hr' };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const startsBlock = (l: string) => /^\s*(```|#{1,6}\s|>|---+\s*$)/.test(l) || BULLET.test(l) || NUMBER.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (/^\s*```/.test(line)) {
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
    } else if (/^\s*---+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
    } else if (/^\s*#{1,6}\s/.test(line)) {
      blocks.push({ type: 'h', text: line.replace(/^\s*#{1,6}\s+/, '').trim() });
      i++;
    } else if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quote.push(lines[i].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join('\n') });
    } else if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line) && !BULLET.test(line);
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const m = (ordered ? NUMBER : BULLET).exec(lines[i]);
        if (m) items.push(m[1]);
        // An indented line continues the item above.
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += `\n${lines[i].trim()}`;
        else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
    } else {
      const text: string[] = [];
      for (; i < lines.length && lines[i].trim() && (text.length === 0 || !startsBlock(lines[i])); i++) text.push(lines[i]);
      blocks.push({ type: 'p', text: text.join('\n') });
    }
  }
  return blocks;
}

/** Links go to http(s), mailto, or a path on the site. Anything else (javascript:, data:) is shown as text. */
export const safeHref = (href: string) => (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href.trim()) ? href.trim() : null);

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|(?<![\w])_[^_\s][^_\n]*?_(?![\w]))|(\[[^\]\n]+\]\([^)\s]+\))/;

function inline(text: string, key = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(...lines(rest, `${key}t${n}`));
      break;
    }
    if (m.index > 0) out.push(...lines(rest.slice(0, m.index), `${key}t${n}`));
    const k = `${key}${n++}`;
    const token = m[0];
    if (m[1]) {
      out.push(
        <code key={k} className="rounded-[4px] bg-mnml-surface px-1 py-0.5 [font-family:ui-monospace,monospace] text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) out.push(<strong key={k}>{inline(token.slice(2, -2), `${k}-`)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(token.slice(1, -1), `${k}-`)}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
      const href = safeHref(link[2]);
      out.push(
        href ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {inline(link[1], `${k}-`)}
          </a>
        ) : (
          token
        ),
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

/** Plain text, with a line break wherever the reply has one. */
function lines(text: string, key: string): ReactNode[] {
  return text.split('\n').flatMap((part, i) => (i === 0 ? [part] : [<br key={`${key}b${i}`} />, part]));
}

function MarkdownBase({ text }: MarkdownProps) {
  return (
    <div className="flex flex-col gap-2 break-words">
      {parseBlocks(text).map((b, i) => {
        switch (b.type) {
          case 'h':
            return (
              <p key={i} className="font-medium">
                {inline(b.text)}
              </p>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={i} className={`flex flex-col gap-1 pl-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </List>
            );
          }
          case 'quote':
            return (
              <blockquote key={i} className="border-l-2 border-mnml-line pl-3 text-mnml-text-soft">
                {inline(b.text)}
              </blockquote>
            );
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-[6px] bg-mnml-surface p-3 [font-family:ui-monospace,monospace] text-xs">
                {b.text}
              </pre>
            );
          case 'hr':
            return <hr key={i} className="border-mnml-line" />;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}

/** The assistant's replies: the built-in renderer, or the site's `Markdown` slot. */
export const Markdown = slotted('Markdown', MarkdownBase);
