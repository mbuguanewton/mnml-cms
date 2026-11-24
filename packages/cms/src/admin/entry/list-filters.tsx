'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ListFilterIcon, XIcon } from 'lucide-react';
import { Button } from '../ui/button.js';
import { DatePicker } from '../ui/date-picker.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { cardClass } from '../ui/styles.js';

/** One filter, as the list page works it out. `eq`, `from` and `to` are the URL parameters it uses. */
export type FilterControl = {
  name: string;
  label: string;
  kind: 'select' | 'date' | 'number';
  /** For `select`: what can be picked (a boolean's are Yes and No). */
  options?: { value: string; label: string }[];
  eq: string;
  from: string;
  to: string;
};

/**
 * The collection list's filters: a button (with how many are set) that opens a panel, and a chip for each set filter.
 * Changes go into the URL next to the search, sort and filters already there, and start the list at page 1.
 */
export function ListFilters({ controls, values }: { controls: FilterControl[]; values: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useId();
  const [v, setV] = useState(values);

  // The URL changed from outside (a chip, back button, Clear link): show its filters. Adjusted during render, not in an effect.
  const signature = JSON.stringify(values);
  const [shown, setShown] = useState(signature);
  if (signature !== shown) {
    setShown(signature);
    setV(values);
  }

  const active = Object.values(v).filter(Boolean).length;
  const [open, setOpen] = useState(active > 0);

  const queued = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Sets (or, with '', removes) URL parameters. Typed numbers wait a moment; the rest apply at once. */
  const commit = (changes: Record<string, string>, wait = 0) => {
    setV((cur) => ({ ...cur, ...changes }));
    Object.assign(queued.current, changes);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      for (const [k, val] of Object.entries(queued.current)) {
        if (val) p.set(k, val);
        else p.delete(k);
      }
      queued.current = {};
      p.delete('page');
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, wait);
  };

  const chips = controls.flatMap((c) => {
    const optionLabel = (x: string) => c.options?.find((o) => o.value === x)?.label ?? x;
    const out: { key: string; text: string; clear: string }[] = [];
    if (v[c.eq]) out.push({ key: c.eq, text: `${c.label}: ${optionLabel(v[c.eq])}`, clear: c.eq });
    const [lo, hi] = c.kind === 'number' ? ['at least', 'at most'] : ['from', 'to'];
    if (v[c.from]) out.push({ key: c.from, text: `${c.label} ${lo} ${v[c.from]}`, clear: c.from });
    if (v[c.to]) out.push({ key: c.to, text: `${c.label} ${hi} ${v[c.to]}`, clear: c.to });
    return out;
  });

  const clearAll = () => commit(Object.fromEntries(controls.flatMap((c) => [c.eq, c.from, c.to]).map((k) => [k, ''])));

  return (
    <>
      <Button variant="outline" aria-expanded={open} aria-controls={`${uid}-panel`} onClick={() => setOpen(!open)}>
        <ListFilterIcon /> Filters
        {active > 0 && <span className="rounded-full bg-mnml-primary px-1.5 text-xs text-mnml-on-primary tabular-nums">{active}</span>}
      </Button>
      {chips.map((c) => (
        <span key={c.key} className="flex items-center gap-1 rounded-full border border-mnml-line bg-mnml-panel py-0.5 pr-1 pl-2.5 text-xs text-mnml-text-soft">
          {c.text}
          <button
            type="button"
            aria-label={`Remove filter: ${c.text}`}
            onClick={() => commit({ [c.clear]: '' })}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full text-mnml-text-mute hover:bg-mnml-surface hover:text-mnml-text"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      {active > 0 && (
        <button type="button" onClick={clearAll} className="cursor-pointer text-xs text-mnml-link underline-offset-2 hover:underline">
          Clear filters
        </button>
      )}
      {open && (
        <div id={`${uid}-panel`} role="group" aria-label="Filters" className={`${cardClass} grid basis-full gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3`}>
          {controls.map((c) => {
            const id = `${uid}-${c.name}`;
            return (
              <div key={c.name} className="flex min-w-0 flex-col gap-1">
                <span id={`${id}-label`} className="text-xs font-medium text-mnml-text-soft">
                  {c.label}
                </span>
                {c.kind === 'select' && (
                  <Select
                    id={id}
                    aria-label={c.label}
                    value={v[c.eq] || null}
                    onChange={(x) => commit({ [c.eq]: x ?? '' })}
                    options={c.options ?? []}
                    placeholder="Any"
                    clearable
                  />
                )}
                {c.kind === 'date' && (
                  <div className="flex flex-col gap-1.5" role="group" aria-labelledby={`${id}-label`}>
                    {(
                      [
                        ['From', c.from],
                        ['To', c.to],
                      ] as const
                    ).map(([word, param]) => (
                      <div key={param} className="flex items-center gap-2">
                        <span className="w-8 shrink-0 text-xs text-mnml-text-mute">{word}</span>
                        <DatePicker
                          id={`${id}-${word.toLowerCase()}`}
                          aria-label={`${c.label} ${word.toLowerCase()}`}
                          value={v[param] || null}
                          onChange={(x) => commit({ [param]: x ?? '' })}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {c.kind === 'number' && (
                  <div className="flex items-center gap-2" role="group" aria-labelledby={`${id}-label`}>
                    <Input
                      id={`${id}-min`}
                      type="number"
                      aria-label={`${c.label} at least`}
                      placeholder="Min"
                      value={v[c.from] ?? ''}
                      onChange={(x) => commit({ [c.from]: x }, 400)}
                    />
                    <span className="text-xs text-mnml-text-mute">to</span>
                    <Input
                      id={`${id}-max`}
                      type="number"
                      aria-label={`${c.label} at most`}
                      placeholder="Max"
                      value={v[c.to] ?? ''}
                      onChange={(x) => commit({ [c.to]: x }, 400)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
