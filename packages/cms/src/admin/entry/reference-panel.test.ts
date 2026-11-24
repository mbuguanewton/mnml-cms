import { describe, expect, it } from 'vite-plus/test';
import { fields } from '../../schema/define.js';
import { createdLabel } from './reference-panel.js';

describe('createdLabel', () => {
  it('marks a draft until it is published', () => {
    expect(createdLabel('Intro', true)).toBe('Intro (draft)');
    expect(createdLabel('Intro', false)).toBe('Intro');
  });
});

describe('createNew', () => {
  it('is on unless a field turns it off', () => {
    expect(fields.reference('Author', 'authors').createNew).toBeUndefined();
    expect(fields.reference('Author', 'authors', { createNew: false }).createNew).toBe(false);
    expect(fields.references('Related', 'posts', { max: 3, createNew: false })).toMatchObject({ max: 3, createNew: false });
  });
});
