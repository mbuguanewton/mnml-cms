import { describe, expect, it } from 'vite-plus/test';
import { applies, BUILT_IN, confirmation, summary } from './list-actions.js';

const action = (name: string) => BUILT_IN.find((a) => a.name === name)!;

describe('applies', () => {
  it('publishes drafts and entries with changes, not live ones', () => {
    expect(['draft', 'changes', 'published'].map((s) => applies('publish', s as never))).toEqual([true, true, false]);
  });
  it('unpublishes live entries and ones with changes, not drafts', () => {
    expect(['draft', 'changes', 'published'].map((s) => applies('unpublish', s as never))).toEqual([false, true, true]);
  });
  it('lets delete and a site action apply to anything', () => {
    for (const s of ['draft', 'changes', 'published'] as const) expect([applies('delete', s), applies('feature', s)]).toEqual([true, true]);
  });
});

describe('confirmation', () => {
  it('does not ask before publishing', () => {
    expect(confirmation(action('publish'), 3, 0)).toBeNull();
  });
  it('asks before unpublishing and deleting, saying how many are live', () => {
    expect(confirmation(action('unpublish'), 2, 2)).toEqual({ title: 'Unpublish 2 entries?', description: 'They leave the site and become drafts.' });
    expect(confirmation(action('delete'), 1, 1)?.description).toMatch(/1 of them is published/);
    expect(confirmation(action('delete'), 4, 3)?.description).toMatch(/3 of them are published/);
    expect(confirmation(action('delete'), 2, 0)).toEqual({ title: 'Delete 2 entries?', description: 'This cannot be undone.' });
  });
  it('asks before a site action only when it has confirm text', () => {
    expect(confirmation({ name: 'feature', label: 'Feature' }, 2, 0)).toBeNull();
    expect(confirmation({ name: 'ping', label: 'Ping', confirm: 'Emails the authors.' }, 1, 0)).toEqual({
      title: 'Ping 1 entry?',
      description: 'Emails the authors.',
    });
  });
});

describe('summary', () => {
  it('reports what was done, skipped and failed', () => {
    expect(summary(action('publish'), { done: 3, skipped: 1, failed: 0 })).toBe('Published 3 entries · 1 skipped');
    expect(summary(action('delete'), { done: 1, skipped: 0, failed: 2 })).toBe('Deleted 1 entry · 2 failed');
    expect(summary(action('unpublish'), { done: 0, skipped: 2, failed: 0 })).toBe('Nothing changed · 2 skipped');
    expect(summary({ name: 'feature', label: 'Feature' }, { done: 2, skipped: 0, failed: 0 })).toBe('Feature 2 entries');
  });
});
