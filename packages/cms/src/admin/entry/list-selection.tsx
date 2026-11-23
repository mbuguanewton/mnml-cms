'use client';

import { createContext, use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { useAdmin } from '../shell/context.js';
import { applies, BUILT_IN, confirmation, summary, type RowAction, type RowStatus } from './list-actions.js';

/** One row of the list page, as the selection knows it. */
export type ListRow = { slug: string; status: RowStatus };

type Selection = { selected: ReadonlySet<string>; rows: ListRow[]; toggle: (slug: string) => void; toggleAll: () => void };
const SelectionContext = createContext<Selection>({ selected: new Set(), rows: [], toggle: () => {}, toggleAll: () => {} });

type BulkResponse = {
  ok: boolean;
  message?: string;
  results?: { done: string[]; skipped: { slug: string; message: string }[]; failed: { slug: string; message: string }[] };
};

/**
 * Row selection for the collection list: `ListHeaderCheck` and `ListRowCheck` in the table, and a bar at the bottom
 * with the actions that apply (Publish, Unpublish, Delete, then the site's own). Give it a `key` that changes with the
 * list (search, filters, sort, page) so a new list starts with nothing selected.
 */
export function ListSelection({
  collection,
  rows,
  actions = [],
  children,
}: {
  collection: string;
  rows: ListRow[];
  actions?: RowAction[];
  children: React.ReactNode;
}) {
  const { post, confirm, alert, toast } = useAdmin();
  const router = useRouter();
  // Not a transition: the confirmation dialog opens from inside the action, and a transition would hold its state back until the action ended.
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = (slug: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });
  const toggleAll = () => setSelected((cur) => (rows.length > 0 && rows.every((r) => cur.has(r.slug)) ? new Set() : new Set(rows.map((r) => r.slug))));

  const chosen = rows.filter((r) => selected.has(r.slug));
  const bar = [...BUILT_IN, ...actions];

  const run = async (action: RowAction) => {
    const targets = chosen.filter((r) => applies(action.name, r.status));
    if (targets.length === 0) return;
    const ask = confirmation(action, targets.length, targets.filter((r) => r.status !== 'draft').length);
    if (ask && !(await confirm({ ...ask, confirmLabel: action.label, danger: action.danger }))) return;
    setPending(true);
    try {
      let r: BulkResponse;
      try {
        r = await post<BulkResponse>('bulk', { key: collection, slugs: targets.map((t) => t.slug), action: action.name });
      } catch (e) {
        return await alert({ title: `${action.label} failed`, description: (e as Error).message });
      }
      if (!r.ok || !r.results) return await alert({ title: `${action.label} failed`, description: r.message ?? 'Something went wrong.' });
      const { done, skipped, failed } = r.results;
      toast({
        title: summary(action, { done: done.length, skipped: skipped.length, failed: failed.length }),
        tone: failed.length > 0 ? 'danger' : done.length > 0 ? 'success' : 'info',
      });
      // What went through (or had nothing to do) leaves the selection; failures stay selected to try again.
      setSelected(new Set(failed.map((f) => f.slug)));
      router.refresh();
      if (failed.length > 0) {
        await alert({
          title: `${failed.length} ${failed.length === 1 ? 'entry' : 'entries'} not ${action.name === 'delete' ? 'deleted' : 'changed'}`,
          description: `${failed
            .slice(0, 5)
            .map((f) => `${f.slug}: ${f.message}`)
            .join('. ')}${failed.length > 5 ? `. And ${failed.length - 5} more.` : ''}`,
        });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <SelectionContext value={{ selected, rows, toggle, toggleAll }}>
      {children}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Selected entries"
          className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-[10px] border border-mnml-line bg-mnml-bg px-4 py-2.5 shadow-lg"
        >
          <span aria-live="polite" className="mr-auto font-medium tabular-nums">
            {selected.size} selected
          </span>
          {bar.map((a) => (
            <Button
              key={a.name}
              type="button"
              variant={a.danger ? 'danger' : 'outline'}
              size="sm"
              disabled={pending || !chosen.some((r) => applies(a.name, r.status))}
              onClick={() => void run(a)}
            >
              {a.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </SelectionContext>
  );
}

/** The table header's checkbox: selects or clears every row on the page. */
export function ListHeaderCheck({ label }: { label: string }) {
  const { selected, rows, toggleAll } = use(SelectionContext);
  const all = rows.length > 0 && rows.every((r) => selected.has(r.slug));
  return <Checkbox checked={all} onChange={toggleAll} aria-label={`Select all ${label} on this page`} disabled={rows.length === 0} />;
}

/** A row's checkbox. Above the row's click-to-open overlay, so ticking it never opens the entry. */
export function ListRowCheck({ slug, name }: { slug: string; name: string }) {
  const { selected, toggle } = use(SelectionContext);
  return (
    <div className="relative z-10 flex">
      <Checkbox checked={selected.has(slug)} onChange={() => toggle(slug)} aria-label={`Select ${name}`} />
    </div>
  );
}
