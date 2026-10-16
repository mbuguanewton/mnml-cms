// Moving content between databases (dev → prod, prod → dev), built on `EntryStorage`. No Next.js needed, so
// it runs from a plain script (`tsx scripts/content.ts`). Only the config's own collections and their
// autosaved drafts travel: never sign-in state, and never uploaded files (see `missingMedia`).
import { z } from 'zod';
import { canonical } from './canonical.js';
import { objectSchema, slugSchema, withDefaults, type CmsConfig } from './define.js';
import type { EntryStorage } from './server/storage.js';

// Everything a script needs to reach a database and its media, so it doesn't import the Next.js-only entry.
export { drizzleStorage } from './server/storage.js';
export { neonDatabase } from './server/db.js';
export { localMedia, vercelBlobMedia, type MediaStorage } from './server/media.js';

// Autosaved changes to an entry live under `pending:<key>` (see the store).
const PENDING = 'pending:';

export type ContentEntry = { collection: string; slug: string; status: 'draft' | 'published'; data: unknown };
export type ContentFile = { version: 1; exportedAt: string; entries: ContentEntry[] };

const fileSchema = z.object({
  version: z.literal(1, 'Unknown file version'),
  exportedAt: z.string(),
  entries: z.array(z.object({ collection: z.string(), slug: z.string(), status: z.enum(['draft', 'published']), data: z.unknown() })),
});

/** Checks a parsed JSON file and returns it, or throws a readable error. */
export function parseContentFile(json: unknown): ContentFile {
  const r = fileSchema.safeParse(json);
  if (!r.success) throw new Error(`Not a content file: ${r.error.issues[0].path.join('.') || 'file'}: ${r.error.issues[0].message}`);
  return r.data as ContentFile;
}

/** Everything the config's collections hold, plus their autosaved drafts, in a stable order. */
export async function exportContent(config: CmsConfig, storage: EntryStorage): Promise<ContentFile> {
  const entries: ContentEntry[] = [];
  for (const key of Object.keys(config)) {
    for (const collection of [key, PENDING + key]) {
      for (const r of await storage.readRows(collection)) {
        entries.push({ collection, slug: r.slug, status: r.status === 'draft' ? 'draft' : 'published', data: r.data });
      }
    }
  }
  entries.sort((a, b) => a.collection.localeCompare(b.collection) || a.slug.localeCompare(b.slug));
  return { version: 1, exportedAt: new Date().toISOString(), entries };
}

/**
 * - `add`: only entries the target doesn't have.
 * - `overwrite`: also replace entries that differ.
 * - `replace`: make the target's content match the file, deleting what the file doesn't have.
 */
export type ImportMode = 'add' | 'overwrite' | 'replace';

export type ImportPlan = {
  add: ContentEntry[];
  change: ContentEntry[];
  same: ContentEntry[];
  /** In the target but not in the file; deleted by `replace`. */
  remove: { collection: string; slug: string }[];
  /** Entries that don't fit this config. Nothing is written while there are any. */
  invalid: { collection: string; slug: string; message: string }[];
  /** Entries for collections this config doesn't have, by collection. They are left out. */
  skipped: Record<string, number>;
};

const at = (collection: string, slug: string) => `${collection}\0${slug}`;

/** Compares the file with the target without writing anything. */
export async function planImport(config: CmsConfig, storage: EntryStorage, file: ContentFile, mode: ImportMode): Promise<ImportPlan> {
  const plan: ImportPlan = { add: [], change: [], same: [], remove: [], invalid: [], skipped: {} };
  const target = new Map((await exportContent(config, storage)).entries.map((e) => [at(e.collection, e.slug), e]));
  const seen = new Set<string>();

  for (const e of file.entries) {
    const key = e.collection.startsWith(PENDING) ? e.collection.slice(PENDING.length) : e.collection;
    const def = Object.hasOwn(config, key) ? config[key] : undefined;
    if (!def) {
      plan.skipped[e.collection] = (plan.skipped[e.collection] ?? 0) + 1;
      continue;
    }
    const problem =
      def.kind === 'singleton' && e.slug !== 'singleton'
        ? 'A singleton has one entry, with the slug "singleton"'
        : def.kind === 'collection' && !slugSchema.safeParse(e.slug).success
          ? 'Invalid slug'
          : e.collection.startsWith(PENDING) && e.status !== 'published'
            ? 'Autosaved changes are always stored as published'
            : (() => {
                // Fill in fields added since the entry was saved, like a read does, then check it.
                const r = objectSchema(def.fields).safeParse(withDefaults(def.fields, e.data));
                return r.success ? null : `${r.error.issues[0].path.join('.') || 'data'}: ${r.error.issues[0].message}`;
              })();
    if (problem) {
      plan.invalid.push({ collection: e.collection, slug: e.slug, message: problem });
      continue;
    }

    const id = at(e.collection, e.slug);
    seen.add(id);
    const existing = target.get(id);
    if (!existing) plan.add.push(e);
    else if (
      existing.status === e.status &&
      JSON.stringify(canonical(withDefaults(def.fields, existing.data))) === JSON.stringify(canonical(withDefaults(def.fields, e.data)))
    )
      plan.same.push(e);
    else plan.change.push(e);
  }

  if (mode === 'replace') {
    for (const [id, e] of target) if (!seen.has(id)) plan.remove.push({ collection: e.collection, slug: e.slug });
  }
  return plan;
}

/**
 * Writes a plan. The database may not support transactions, so this is not atomic: if it stops halfway,
 * run it again. It only inserts or replaces by (collection, slug), so repeating it is safe.
 * Writes before it deletes, so a `replace` never leaves the target empty in between.
 */
export async function applyImport(storage: EntryStorage, plan: ImportPlan, mode: ImportMode): Promise<{ added: number; changed: number; removed: number }> {
  if (plan.invalid.length > 0) throw new Error(`${plan.invalid.length} entries don't fit the config; nothing was written.`);
  let added = 0;
  for (const e of plan.add) if (await storage.insertIfAbsent(e.collection, e.slug, e.data, e.status)) added++;
  let changed = 0;
  if (mode !== 'add') {
    for (const e of plan.change) {
      await storage.upsert(e.collection, e.slug, e.data, e.status);
      changed++;
    }
  }
  let removed = 0;
  if (mode === 'replace') {
    for (const r of plan.remove) {
      await storage.remove(r.collection, r.slug);
      removed++;
    }
  }
  return { added, changed, removed };
}

/** A readable summary of a plan, for a dry run. */
export function describePlan(plan: ImportPlan, mode: ImportMode): string {
  const list = (title: string, items: { collection: string; slug: string }[]) =>
    items.length === 0
      ? []
      : [
          `${title} (${items.length}):`,
          ...items.slice(0, 25).map((e) => `  ${e.collection}/${e.slug}`),
          ...(items.length > 25 ? [`  … and ${items.length - 25} more`] : []),
        ];
  return [
    `Mode: ${mode}`,
    ...list('New in the target', plan.add),
    ...list(mode === 'add' ? 'Different in the target (kept, not changed in add mode)' : 'Different in the target (will be overwritten)', plan.change),
    `Identical: ${plan.same.length}`,
    ...(mode === 'replace' ? list('Only in the target (will be deleted)', plan.remove) : []),
    ...Object.entries(plan.skipped).map(([c, n]) => `Skipped ${n} from "${c}": not in this config`),
    ...(plan.invalid.length
      ? [
          `Invalid (${plan.invalid.length}), nothing can be written until these are fixed:`,
          ...plan.invalid.map((i) => `  ${i.collection}/${i.slug}: ${i.message}`),
        ]
      : []),
  ].join('\n');
}

/** The uploaded-file keys that entries refer to (`<apiPath>/media/<key>`). */
export function mediaKeys(file: ContentFile, apiPath = '/api/mnml'): string[] {
  const pattern = new RegExp(`${apiPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/media/([\\w.\\-/]+)`, 'g');
  const found = new Set<string>();
  for (const e of file.entries) for (const m of JSON.stringify(e.data).matchAll(pattern)) found.add(m[1]);
  return [...found].sort();
}

/**
 * The files the content refers to that the target's media storage doesn't have. Uploaded files are not part
 * of an export, so images added in one environment show as broken in another until the files are copied.
 */
export async function missingMedia(file: ContentFile, exists: (key: string) => Promise<boolean>, apiPath?: string): Promise<string[]> {
  const missing: string[] = [];
  for (const key of mediaKeys(file, apiPath)) if (!(await exists(key))) missing.push(key);
  return missing;
}
