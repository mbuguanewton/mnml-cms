import { describe, expect, it } from 'vite-plus/test';
import { PgDialect } from 'drizzle-orm/pg-core';

const { postgresSearch } = await import('./postgres.js');
type Database = import('../content/db.js').Database;

const dialect = new PgDialect();

/** A database that records the SQL it is asked to run, and answers from a queue of row lists. */
function fakeDb(answers: unknown[][] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const database = {
    execute: async (q: Parameters<PgDialect['sqlToQuery']>[0]) => {
      const { sql, params } = dialect.sqlToQuery(q);
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: answers.shift() ?? [] };
    },
  } as unknown as Database;
  return { calls, database };
}

const chunk = (idx: number, hash: string) => ({ field: 'body', idx, text: `text ${idx}`, hash });
const entry = (chunks: ReturnType<typeof chunk>[], slug: string | null = 'a') => ({ key: 'posts', slug, title: 'Title', url: '/posts/a', chunks });

describe('postgresSearch.put', () => {
  it('writes only the passages whose hash changed, and drops the tail', async () => {
    const { calls, database } = fakeDb([
      [
        { idx: 0, hash: 'same' },
        { idx: 1, hash: 'old' },
        { idx: 2, hash: 'tail' },
      ],
    ]);
    await postgresSearch({ database }).put(entry([chunk(0, 'same'), chunk(1, 'new')]));
    expect(calls).toHaveLength(3);
    expect(calls[1].sql).toContain('insert into "mnml_chunks"');
    expect(calls[1].params).toContain('new');
    expect(calls[1].params).not.toContain('same');
    expect(calls[2].sql).toContain('delete from "mnml_chunks"');
    expect(calls[2].params).toEqual(['posts', 'a', 2]);
  });

  it('skips the insert when nothing changed, and still drops stale passages', async () => {
    const { calls, database } = fakeDb([
      [
        { idx: 0, hash: 'h' },
        { idx: 1, hash: 'h1' },
      ],
    ]);
    await postgresSearch({ database }).put(entry([chunk(0, 'h')]));
    expect(calls.map((c) => c.sql.split(' ')[0])).toEqual(['select', 'delete']);
    expect(calls[1].params).toEqual(['posts', 'a', 1]);
  });

  it('stores a singleton under the singleton slug', async () => {
    const { calls, database } = fakeDb();
    await postgresSearch({ database }).put(entry([chunk(0, 'h')], null));
    expect(calls[0].params).toEqual(['posts', 'singleton']);
  });
});

describe('postgresSearch.remove and prune', () => {
  it('removes an entry', async () => {
    const { calls, database } = fakeDb();
    await postgresSearch({ database }).remove('posts', null);
    expect(calls[0].params).toEqual(['posts', 'singleton']);
  });

  it('prunes only entries that are not live', async () => {
    const { calls, database } = fakeDb([
      [
        { collection: 'posts', slug: 'a' },
        { collection: 'posts', slug: 'gone' },
        { collection: 'settings', slug: 'singleton' },
      ],
    ]);
    await postgresSearch({ database }).prune!([
      { key: 'posts', slug: 'a' },
      { key: 'settings', slug: null },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1].params).toEqual(['posts', 'gone']);
  });
});

describe('postgresSearch.query', () => {
  const row = { key: 'posts', slug: 'a', title: 'T', url: '/posts/a', field: 'body', text: 'hello', score: '0.5' };

  it('searches with websearch_to_tsquery and returns numbers for scores', async () => {
    const { calls, database } = fakeDb([[row]]);
    expect(await postgresSearch({ database }).query('refund policy', { limit: 5 })).toEqual([{ ...row, score: 0.5 }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("websearch_to_tsquery('english', $1)");
    expect(calls[0].sql).toContain('distinct on (collection, slug)');
    expect(calls[0].params).toEqual(['refund policy', 5]);
  });

  it('falls back to any word when all of them match nothing', async () => {
    const { calls, database } = fakeDb([[], [row]]);
    expect(await postgresSearch({ database }).query('How do refunds work?', { limit: 5 })).toHaveLength(1);
    expect(calls[1].sql).toContain("to_tsquery('english', $1)");
    expect(calls[1].params).toEqual(['how | do | refunds | work', 5]);
  });

  it('limits to the collections asked for', async () => {
    const { calls, database } = fakeDb([[]]);
    await postgresSearch({ database, language: 'simple' }).query('x', { collections: ['posts', 'pages'], limit: 3 });
    expect(calls[0].sql).toContain("websearch_to_tsquery('simple', $1)");
    expect(calls[0].sql).toContain('collection in ($2, $3)');
    expect(calls[0].params).toEqual(['x', 'posts', 'pages', 3]);
  });
});

describe('postgresSearch options', () => {
  it('refuses a table or language that is not a plain name', () => {
    const { database } = fakeDb();
    expect(() => postgresSearch({ database, table: 'a; drop table b' })).toThrow('table name');
    expect(() => postgresSearch({ database, language: "x'; --" })).toThrow('language');
  });
});
