import { describe, expect, it } from 'vite-plus/test';
import { ACTIVITY_MAX, MERGE_MS, changedFields, createActivity } from './activity.js';
import type { EntryStorage } from './storage.js';

type Row = { collection: string; slug: string; data: unknown; status: string };

function memory() {
  const rows: Row[] = [];
  const now = new Date();
  const storage: EntryStorage = {
    readRow: async (c, s) => rows.find((r) => r.collection === c && r.slug === s),
    readRows: async (c) => rows.filter((r) => r.collection === c).map((r) => ({ ...r, createdAt: now, updatedAt: now })),
    upsert: async (c, s, data, status) => {
      const r = rows.find((x) => x.collection === c && x.slug === s);
      if (r) Object.assign(r, { data, status });
      else rows.push({ collection: c, slug: s, data, status });
    },
    insertIfAbsent: async () => true,
    remove: async (c, s) => {
      const i = rows.findIndex((r) => r.collection === c && r.slug === s);
      if (i >= 0) rows.splice(i, 1);
    },
  };
  /** The events stored, without the open-run markers. */
  const events = () => rows.filter((r) => !r.slug.endsWith('~head'));
  return { rows, storage, events };
}

const admin = { type: 'admin', label: 'Admin' } as const;
const at = (ms: number) => new Date(Date.UTC(2026, 10, 27, 12) + ms);
const ev = (action: 'publish' | 'autosave', over: object = {}) => ({ key: 'posts', slug: 'a', action, by: admin, ...over });

describe('activity log', () => {
  it('stores one row per event under activity:<key> and lists them newest first', async () => {
    const { rows, storage } = memory();
    const log = createActivity(storage);
    await log.log(ev('publish'), at(0));
    await log.log(ev('publish', { summary: 'second' }), at(1000));
    expect(rows.every((r) => r.collection === 'activity:posts')).toBe(true);
    const list = await log.list('posts', 'a');
    expect(list.map((e) => e.summary)).toEqual(['second', undefined]);
    expect(list[0].at).toBe(at(1000).toISOString());
  });

  it("keeps entries apart, even when one slug starts with another's", async () => {
    const { storage } = memory();
    const log = createActivity(storage);
    await log.log(ev('publish'), at(0));
    await log.log(ev('publish', { slug: 'a~b' }), at(1));
    await log.log(ev('publish', { slug: 'ab' }), at(2));
    expect(await log.list('posts', 'a')).toHaveLength(1);
    expect(await log.list('posts', 'ab')).toHaveLength(1);
  });

  it('merges a run of autosaves by the same person into one row', async () => {
    const { events, storage } = memory();
    const log = createActivity(storage);
    await log.log(ev('autosave', { fields: ['title'] }), at(0));
    await log.log(ev('autosave', { fields: ['body'] }), at(60_000));
    expect(events()).toHaveLength(1);
    const [e] = await log.list('posts', 'a');
    expect(e.fields).toEqual(['title', 'body']);
    expect(e.at).toBe(at(60_000).toISOString());
  });

  it('does not merge across a publish, another person, or a long pause', async () => {
    const { events, storage } = memory();
    const log = createActivity(storage);
    await log.log(ev('autosave'), at(0));
    await log.log(ev('autosave', { by: { type: 'admin', label: 'Ada' } }), at(1000));
    await log.log(ev('autosave', { by: { type: 'admin', label: 'Ada' } }), at(1000 + MERGE_MS + 1));
    await log.log(ev('publish', { by: { type: 'admin', label: 'Ada' } }), at(1000 + MERGE_MS + 2));
    await log.log(ev('autosave', { by: { type: 'admin', label: 'Ada' } }), at(1000 + MERGE_MS + 3));
    expect(events()).toHaveLength(5);
  });

  it('drops the oldest events beyond the cap', async () => {
    const { rows, storage } = memory();
    const log = createActivity(storage);
    for (let i = 0; i < ACTIVITY_MAX + 5; i++) await log.log(ev('publish', { summary: String(i) }), at(i * 1000));
    expect(rows).toHaveLength(ACTIVITY_MAX);
    const list = await log.list('posts', 'a');
    expect(list[0].summary).toBe(String(ACTIVITY_MAX + 4));
    expect(list.at(-1)?.summary).toBe('5');
  });

  it('ignores stored rows that are not events', async () => {
    const { rows, storage } = memory();
    rows.push({ collection: 'activity:posts', slug: 'a~junk', data: { nope: true }, status: 'published' });
    rows.push({ collection: 'activity:posts', slug: 'a~junk2', data: 'text', status: 'published' });
    const log = createActivity(storage);
    await log.log(ev('publish'), at(0));
    expect(await log.list('posts', 'a')).toHaveLength(1);
  });
});

describe('a burst of autosaves', () => {
  /** Storage that counts what it is asked to do. */
  function counted() {
    const m = memory();
    const calls = { readRows: 0, upsert: 0 };
    const base = m.storage;
    m.storage = {
      ...base,
      readRows: async (c) => (calls.readRows++, base.readRows(c)),
      upsert: async (c, s, d, st) => (calls.upsert++, base.upsert(c, s, d, st)),
    };
    return { ...m, calls };
  }

  it('writes once, then only when a field is new or 30 seconds have passed', async () => {
    const { storage, calls } = counted();
    const log = createActivity(storage);
    await log.log(ev('autosave', { fields: ['title'] }), at(0));
    const first = { ...calls };
    expect(first.upsert).toBe(2); // the event and the open run
    for (let i = 1; i <= 20; i++) await log.log(ev('autosave', { fields: ['title'] }), at(i * 1000));
    expect(calls.upsert).toBe(first.upsert);
    await log.log(ev('autosave', { fields: ['body'] }), at(21_000));
    expect(calls.upsert).toBe(first.upsert + 2);
    await log.log(ev('autosave', { fields: ['title'] }), at(21_000 + 30_000));
    expect(calls.upsert).toBe(first.upsert + 4);
    const list = await log.list('posts', 'a');
    expect(list).toHaveLength(1);
    expect(list[0].fields).toEqual(['title', 'body']);
  });

  it('reads one row for a merged autosave, not the whole log', async () => {
    const { storage, calls } = counted();
    const log = createActivity(storage);
    await log.log(ev('autosave', { fields: ['title'] }), at(0));
    const reads = calls.readRows;
    await log.log(ev('autosave', { fields: ['body'] }), at(40_000));
    await log.log(ev('autosave', { fields: ['title'] }), at(80_000));
    expect(calls.readRows).toBe(reads);
  });

  it('ends the run at any other event, and the next autosave starts a new one', async () => {
    const { storage } = counted();
    const log = createActivity(storage);
    await log.log(ev('autosave', { fields: ['title'] }), at(0));
    await log.log(ev('publish'), at(1000));
    await log.log(ev('autosave', { fields: ['title'] }), at(2000));
    expect((await log.list('posts', 'a')).map((e) => e.action)).toEqual(['autosave', 'publish', 'autosave']);
  });

  it('keeps the runs of two entries apart', async () => {
    const { storage } = counted();
    const log = createActivity(storage);
    await log.log(ev('autosave', { fields: ['title'] }), at(0));
    await log.log(ev('autosave', { slug: 'b', fields: ['title'] }), at(1000));
    expect(await log.list('posts', 'a')).toHaveLength(1);
    expect(await log.list('posts', 'b')).toHaveLength(1);
  });
});

describe('changedFields', () => {
  it('names the top-level fields whose value differs', () => {
    expect(changedFields({ a: 1, b: [1], c: 'x' }, { a: 1, b: [1, 2], d: 'y' })).toEqual(['b', 'c', 'd']);
    expect(changedFields(undefined, { a: 1 })).toEqual(['a']);
    expect(changedFields({ a: 1 }, { a: 1 })).toEqual([]);
    // Same value, keys in another order (what a JSONB column hands back).
    expect(changedFields({ doc: { x: 1, y: [{ b: 1, a: 2 }] } }, { doc: { y: [{ a: 2, b: 1 }], x: 1 } })).toEqual([]);
  });
});
