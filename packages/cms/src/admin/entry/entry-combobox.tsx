'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { placePopover } from '../ui/position.js';
import { inputClass } from '../ui/styles.js';

export type EntryOption = { slug: string; label: string };

/** The options whose title or slug contains the query (case-insensitive); all of them for an empty query. */
export function filterOptions(options: EntryOption[], query: string): EntryOption[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)) : options;
}

/**
 * A text box that filters entries as you type and picks one: ↓/↑ to move, Enter to pick, Escape to close (again to
 * clear). Enter never submits the surrounding form.
 */
export function EntryCombobox({
  id,
  options,
  onPick,
  disabled,
  placeholder = 'Search…',
  invalid,
}: {
  id: string;
  options: EntryOption[];
  onPick: (slug: string) => void;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const shown = filterOptions(options, query);
  const current = Math.max(0, Math.min(active, shown.length - 1));
  const optionId = (i: number) => `${listId}-option-${i}`;

  // The list is a popover (top layer, fixed): it doesn't change the page's height, flips above the box and shrinks to the
  // room it has. Placed again when the matches change its height, and when the page moves.
  const visible = open && !disabled;
  useLayoutEffect(() => {
    const el = list.current;
    if (!visible || !el || !input.current) return;
    if (!el.matches(':popover-open')) el.showPopover();
    placePopover(el, input.current, { matchWidth: true, fit: true });
  }, [visible, shown.length]);
  useEffect(() => {
    if (!visible) return;
    const follow = (e: Event) => {
      if (list.current && input.current && !(e.target instanceof Node && list.current.contains(e.target)))
        placePopover(list.current, input.current, { matchWidth: true, fit: true });
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [visible]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (o: EntryOption) => {
    onPick(o.slug);
    setQuery('');
    setActive(0);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.max(0, Math.min(shown.length - 1, current + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && shown[current]) pick(shown[current]);
    } else if (e.key === 'Escape') {
      // Inside a dialog, the first Escape closes the list, not the dialog.
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        e.preventDefault();
        setQuery('');
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && shown.length ? optionId(current) : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {visible && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          popover="manual"
          className="max-h-64 overflow-y-auto rounded-[8px] border border-mnml-line bg-mnml-bg p-1 text-sm text-mnml-text shadow-lg [font-family:ui-sans-serif,system-ui,sans-serif]"
        >
          {shown.length === 0 ? (
            <li role="presentation" className="px-2.5 py-2 text-mnml-text-mute">
              No matches
            </li>
          ) : (
            shown.map((o, i) => (
              <li
                key={o.slug}
                id={optionId(i)}
                role="option"
                aria-selected={i === current}
                // mousedown, not click: picks before the input loses focus.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer truncate rounded-[6px] px-2.5 py-1.5 ${i === current ? 'bg-mnml-surface' : ''}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
