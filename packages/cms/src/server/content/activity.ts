import type { ActivityActor, ActivityEvent } from '../../api.js';
import type { EntryStorage } from './storage.js';

/** Events kept for each entry. The oldest go first. */
export const ACTIVITY_MAX = 200;
/** An autosave by the same person within this time replaces the last autosave instead of adding a row. */
export const MERGE_MS = 10 * 60_000;

/** Within this time of its last write, an autosave that adds no new field to the run doesn't write at all. */
export const QUIET_MS = 30_000;

/** Breaks ties between events in the same millisecond, so they list in the order they happened. */
let seq = 0;
const collectionOf = (key: string) => `activity:${key}`;

const isActor = (a: unknown): a is ActivityActor =>
  !!a && typeof a === 'object' && typeof (a as ActivityActor).label === 'string' && ['admin', 'agent', 'assistant'].includes((a as ActivityActor).type);

/** Stored data is JSON from a database: only trust what has the shape. */
function parse(data: unknown): ActivityEvent | null {
  const e = data as ActivityEvent | null;
  if (!e || typeof e !== 'object' || typeof e.at !== 'string' || typeof e.action !== 'string' || typeof e.slug !== 'string' || !isActor(e.by)) return null;
  return e;
}

/** The run of autosaves still open for an entry, kept in one row so an autosave reads one row, not the whole log. */
const headRow = (slug: string) => `${slug}~head`;
function parseHead(data: unknown): { row: string; event: Omit<ActivityEvent, 'id'> } | null {
  const h = data as { head?: boolean; row?: unknown; event?: unknown } | null;
  const event = h?.head === true && typeof h.row === 'string' ? parse(h.event) : null;
  return event ? { row: h!.row as string, event } : null;
}

const same = (a: ActivityActor, b: ActivityActor) => a.type === b.type && a.label === b.label && a.id === b.id;

export type NewActivity = Omit<ActivityEvent, 'id' | 'at'>;

/**
 * The activity log: one row per event in the entries table, under the collection `activity:<key>` (like `pending:`
 * and `request:`), so it needs no table of its own and works with any `storage`.
 */
export function createActivity(storage: EntryStorage) {
  /** Newest first. Read straight from storage: it must see what this request just wrote. */
  async function read(key: string, slug: string) {
    const rows = await storage.readRows(collectionOf(key));
    const out: { row: string; event: ActivityEvent }[] = [];
    for (const r of rows) {
      const event = parse(r.data);
      if (event && event.slug === slug) out.push({ row: r.slug, event: { ...event, id: r.slug } });
    }
    return out.sort((a, b) => b.event.at.localeCompare(a.event.at) || b.row.localeCompare(a.row));
  }

  return {
    /** The events of one entry (or a singleton), newest first. */
    async list(key: string, slug: string, limit = ACTIVITY_MAX): Promise<ActivityEvent[]> {
      return (await read(key, slug)).slice(0, limit).map((r) => r.event);
    },

    /**
     * Adds an event. A run of autosaves is one row that grows: an autosave by the same person within `MERGE_MS` updates
     * it, and writes nothing at all within `QUIET_MS` of the last write when it adds no new field. Any other event ends
     * the run. Drops the oldest events beyond `ACTIVITY_MAX`.
     */
    async log(e: NewActivity, now = new Date()) {
      const coll = collectionOf(e.key);
      const stamp = now.toISOString();
      if (e.action === 'autosave') {
        const head = parseHead((await storage.readRow(coll, headRow(e.slug)))?.data);
        const age = head ? now.getTime() - Date.parse(head.event.at) : Infinity;
        if (head && same(head.event.by, e.by) && age < MERGE_MS) {
          const had = head.event.fields ?? [];
          const fields = [...new Set([...had, ...(e.fields ?? [])])].slice(0, 20);
          if (age < QUIET_MS && fields.length === had.length) return;
          const event = { ...head.event, at: stamp, ...(fields.length && { fields }) };
          await storage.upsert(coll, head.row, event, 'published');
          await storage.upsert(coll, headRow(e.slug), { head: true, row: head.row, event }, 'published');
          return;
        }
      } else {
        await storage.remove(coll, headRow(e.slug));
      }
      const list = await read(e.key, e.slug);
      seq = (seq + 1) % 1_679_616;
      const row = `${e.slug}~${now.getTime().toString(36).padStart(9, '0')}-${seq.toString(36).padStart(4, '0')}-${crypto.randomUUID().slice(0, 4)}`;
      const event = { ...e, at: stamp };
      await storage.upsert(coll, row, event, 'published');
      if (e.action === 'autosave') await storage.upsert(coll, headRow(e.slug), { head: true, row, event }, 'published');
      for (const old of list.slice(ACTIVITY_MAX - 1)) await storage.remove(coll, old.row);
    },
  };
}

export type Activity = ReturnType<typeof createActivity>;

/** JSON with object keys in order: a database may hand back the same object with its keys shuffled. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x,
  ) ?? '';

/** Top-level fields whose value differs, at most 20. */
export function changedFields(before: unknown, after: unknown): string[] {
  const a = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>;
  const b = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => stable(a[k]) !== stable(b[k])).slice(0, 20);
}
