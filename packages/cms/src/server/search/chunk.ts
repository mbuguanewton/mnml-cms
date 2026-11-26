import type { JSONContent } from '@tiptap/core';
import { docToText } from '../../schema/fit.js';
import type { Collection, Field, Fields, Singleton } from '../../schema/define.js';

/** About 400 tokens. */
export const MAX_CHUNK = 1600;

export type Chunk = { field: string; idx: number; text: string };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function fieldText(f: Field, v: unknown, out: string[]): void {
  switch (f.type) {
    case 'text':
    case 'textarea':
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
      return;
    case 'richtext': {
      const t = isObject(v) && v.type === 'doc' ? docToText(v as JSONContent) : '';
      if (t) out.push(t);
      return;
    }
    case 'tags':
      if (Array.isArray(v)) {
        const t = v.filter((x) => typeof x === 'string' && x).join(', ');
        if (t) out.push(t);
      }
      return;
    case 'group':
      if (isObject(v)) fieldsText(f.fields, v, out);
      return;
    case 'array':
      if (Array.isArray(v)) for (const item of v) if (isObject(item)) fieldsText(f.fields, item, out);
      return;
    case 'blocks':
      if (Array.isArray(v))
        for (const item of v) {
          const block = isObject(item) && typeof item.kind === 'string' && Object.hasOwn(f.blocks, item.kind) ? f.blocks[item.kind] : null;
          if (block && isObject(item)) fieldsText(block.fields, item, out);
        }
      return;
    // Numbers, dates, links, images, references and the like are not prose.
    default:
      return;
  }
}

function fieldsText(fields: Fields, data: Record<string, unknown>, out: string[]) {
  for (const [name, f] of Object.entries(fields)) fieldText(f, data[name], out);
}

/** Splits text at paragraph breaks, then sentences, then (for a very long run) anywhere, into pieces of at most `max` characters. */
export function splitText(text: string, max = MAX_CHUNK): string[] {
  const pieces: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= max) {
      pieces.push(p);
      continue;
    }
    let cur = '';
    for (const sentence of p.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > max) {
        if (cur) pieces.push(cur);
        cur = '';
        for (let i = 0; i < sentence.length; i += max) pieces.push(sentence.slice(i, i + max));
      } else if (cur && cur.length + 1 + sentence.length > max) {
        pieces.push(cur);
        cur = sentence;
      } else cur = cur ? `${cur} ${sentence}` : sentence;
    }
    if (cur) pieces.push(cur);
  }
  // Pack neighbours back together up to the limit, so short paragraphs don't each become a chunk.
  const out: string[] = [];
  for (const p of pieces) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + 2 + p.length <= max) out[last] = `${out[last]}\n\n${p}`;
    else out.push(p);
  }
  return out;
}

/**
 * The searchable text of an entry, one chunk list per top-level field (the title field is left out: every chunk
 * carries the title anyway). Rich text, groups, lists and blocks are read through; numbers, dates, links and
 * images are not prose and are skipped.
 */
export function chunkEntry(def: Singleton | Collection, data: unknown): Chunk[] {
  if (!isObject(data)) return [];
  const chunks: Chunk[] = [];
  for (const [name, f] of Object.entries(def.fields)) {
    if (def.kind === 'collection' && name === def.titleField) continue;
    const parts: string[] = [];
    fieldText(f, data[name], parts);
    for (const text of splitText(parts.join('\n\n'))) chunks.push({ field: name, idx: chunks.length, text });
  }
  return chunks;
}
