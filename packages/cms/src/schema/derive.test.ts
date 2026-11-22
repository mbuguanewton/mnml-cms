import { describe, expect, it } from 'vite-plus/test';
import { canonical } from './canonical.js';
import { plainText, readingTime } from './derive.js';

const text = (t: string) => ({ type: 'text', text: t });
const p = (...t: ReturnType<typeof text>[]) => ({ type: 'paragraph', content: t });
const doc = (...content: object[]) => ({ type: 'doc', content });

describe('plainText', () => {
  it('joins inline runs directly and separates blocks with a space', () => {
    expect(plainText(doc(p(text('Hel'), text('lo')), p(text('world'))))).toBe('Hello world');
  });

  it('handles empty input', () => {
    expect(plainText(null)).toBe('');
    expect(plainText(doc())).toBe('');
  });
});

describe('readingTime', () => {
  it('rounds up and is at least one minute', () => {
    expect(readingTime(doc())).toBe(1);
    expect(readingTime(doc(p(text(Array(221).fill('word').join(' ')))))).toBe(2);
    expect(readingTime(doc(p(text('a b c d'))), 2)).toBe(2);
  });
});

describe('canonical', () => {
  it('sorts object keys deeply so reordered copies compare equal', () => {
    const a = { b: 1, a: { d: [{ y: 1, x: 2 }], c: null } };
    const b = { a: { c: null, d: [{ x: 2, y: 1 }] }, b: 1 };
    expect(JSON.stringify(canonical(a))).toBe(JSON.stringify(canonical(b)));
  });
});
