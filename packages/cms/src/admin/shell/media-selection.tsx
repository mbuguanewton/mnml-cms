'use client';

import { createContext, use, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2Icon } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { useAdmin } from './context.js';

/** One stored file, as the Media page knows it. `usedIn` is how many entries use it. */
export type MediaItem = { key: string; name: string; usedIn: number };

type Selection = { selecting: boolean; selected: ReadonlySet<string>; toggle: (key: string) => void };
const SelectionContext = createContext<Selection>({ selecting: false, selected: new Set(), toggle: () => {} });

/** The most files one delete request takes (the server's limit). */
const BATCH = 100;

type DeleteResult = { ok: boolean; deleted?: string[]; failed?: { key: string; message: string }[]; message?: string };

/**
 * Select mode for the Media page: a button above the files, a checkbox on each card (`MediaSelectBox`), and a bar at
 * the bottom with the count, Select all / unused, Clear and Delete. The cards stay server-rendered.
 */
export function MediaSelection({
  items,
  summary,
  canSelect,
  children,
}: {
  items: MediaItem[];
  summary: string;
  canSelect: boolean;
  children: React.ReactNode;
}) {
  const { post, confirm, alert, toast } = useAdmin();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const remove = async () => {
    const chosen = items.filter((i) => selected.has(i.key));
    if (chosen.length === 0) return;
    const used = chosen.filter((i) => i.usedIn > 0);
    const ok = await confirm({
      title: `Delete ${chosen.length} ${chosen.length === 1 ? 'file' : 'files'}?`,
      description:
        used.length > 0
          ? `${used.length} of them ${used.length === 1 ? 'is' : 'are'} still used in entries (${used
              .slice(0, 3)
              .map((i) => `“${i.name}”`)
              .join(', ')}${used.length > 3 ? ', …' : ''}), where the image will be broken. This cannot be undone.`
          : 'This permanently deletes the files. It cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const deleted: string[] = [];
      const failed: { key: string; message: string }[] = [];
      const keys = chosen.map((i) => i.key);
      for (let i = 0; i < keys.length; i += BATCH) {
        const batch = keys.slice(i, i + BATCH);
        try {
          const r = await post<DeleteResult>('media/delete', { keys: batch });
          deleted.push(...(r.deleted ?? []));
          failed.push(...(r.failed ?? (r.ok ? [] : batch.map((key) => ({ key, message: r.message ?? 'Could not delete.' })))));
        } catch (e) {
          failed.push(...batch.map((key) => ({ key, message: (e as Error).message })));
        }
      }
      setSelected((cur) => new Set([...cur].filter((k) => !deleted.includes(k))));
      if (deleted.length > 0) toast({ title: `Deleted ${deleted.length} ${deleted.length === 1 ? 'file' : 'files'}`, tone: 'success' });
      if (failed.length > 0) {
        const name = (key: string) => items.find((i) => i.key === key)?.name ?? key;
        await alert({
          title: `${failed.length} ${failed.length === 1 ? 'file' : 'files'} not deleted`,
          description: `${failed
            .slice(0, 5)
            .map((f) => `${name(f.key)}: ${f.message}`)
            .join('. ')}${failed.length > 5 ? `. And ${failed.length - 5} more.` : ''}`,
        });
      } else stop();
      router.refresh();
    });
  };

  return (
    <SelectionContext value={{ selecting, selected, toggle }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-mnml-text-mute">{summary}</p>
        {canSelect && (
          <Button type="button" variant="outline" size="sm" aria-pressed={selecting} onClick={() => (selecting ? stop() : setSelecting(true))}>
            {selecting ? 'Cancel' : 'Select'}
          </Button>
        )}
      </div>
      {children}
      {selecting && (
        <div
          role="region"
          aria-label="Selected files"
          className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-[10px] border border-mnml-line bg-mnml-bg px-4 py-2.5 shadow-lg"
        >
          <span aria-live="polite" className="mr-auto font-medium tabular-nums">
            {selected.size} selected
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setSelected(new Set(items.map((i) => i.key)))}>
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setSelected(new Set(items.filter((i) => i.usedIn === 0).map((i) => i.key)))}
          >
            Select unused
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending || selected.size === 0} onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={pending || selected.size === 0} onClick={() => void remove()}>
            <Trash2Icon /> {pending ? 'Deleting…' : `Delete${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </Button>
        </div>
      )}
    </SelectionContext>
  );
}

/** The checkbox over a card's image, shown in select mode. */
export function MediaSelectBox({ mediaKey, name }: { mediaKey: string; name: string }) {
  const { selecting, selected, toggle } = use(SelectionContext);
  if (!selecting) return null;
  return (
    <div className="absolute top-2 left-2 z-10 rounded-[6px] bg-mnml-bg/90 p-1 shadow-sm">
      <Checkbox checked={selected.has(mediaKey)} onChange={() => toggle(mediaKey)} aria-label={`Select ${name}`} />
    </div>
  );
}
