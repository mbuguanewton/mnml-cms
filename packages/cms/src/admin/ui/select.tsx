'use client';

import { slotted } from '../ui-context.js';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { placePopover } from './position.js';
import { isTypeahead, selectKey, typeahead } from './select-keys.js';
import type { SelectProps } from './slots.js';

// How long typed letters keep adding to one type-ahead search.
const TYPEAHEAD_MS = 600;

/**
 * A select: a button that opens a listbox in a popover (top layer, so overflow: hidden parents don't clip it).
 * Keyboard as in the WAI-ARIA select-only combobox: arrows, Home/End, PageUp/PageDown, type-ahead, Enter or Space
 * to pick, Escape to close. Focus stays on the button.
 */
function SelectBase({
  id,
  value,
  onChange,
  options,
  placeholder = '—',
  clearable,
  disabled,
  invalid,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps) {
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef({ q: '', at: 0 });
  const [state, setState] = useState({ open: false, active: 0 });
  // The listbox is named like the button's <label> (aria-labelledby on the button would give its value instead).
  const [listLabel, setListLabel] = useState(ariaLabel);
  useEffect(() => {
    const text = [...(button.current?.labels ?? [])].map((l) => l.textContent?.trim()).join(' ');
    setListLabel(ariaLabel ?? (text || undefined));
  }, [ariaLabel]);

  // Keep a stored value that is no longer an option visible instead of silently dropping it.
  const missing = value !== null && !options.some((o) => o.value === value);
  const items: { value: string | null; label: string }[] = [
    ...(clearable ? [{ value: null, label: placeholder }] : []),
    ...(missing ? [{ value, label: `${value} (unavailable)` }] : []),
    ...options,
  ];
  const selected = items.findIndex((o) => o.value === value);
  const current = selected >= 0 && items[selected].value !== null ? items[selected].label : null;
  const optionId = (i: number) => `${listId}-${i}`;

  const close = () => setState((s) => ({ ...s, open: false }));
  const pick = (i: number) => {
    const next = items[i];
    if (next && next.value !== value) onChange(next.value);
  };

  useLayoutEffect(() => {
    const el = list.current;
    if (!el || !button.current) return;
    if (!state.open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    if (!el.matches(':popover-open')) el.showPopover();
    placePopover(el, button.current, { matchWidth: true });
  }, [state.open]);

  // Keep the highlighted option in view.
  useLayoutEffect(() => {
    if (state.open) document.getElementById(optionId(state.active))?.scrollIntoView({ block: 'nearest' });
    // oxlint-disable-next-line react/exhaustive-deps
  }, [state.open, state.active]);

  // While open: close on a press outside, follow the button when the page scrolls or resizes.
  useEffect(() => {
    if (!state.open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) close();
    };
    const follow = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return;
      if (list.current && button.current) placePopover(list.current, button.current, { matchWidth: true });
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [state.open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isTypeahead(e)) {
      const now = Date.now();
      const s = search.current;
      s.q = now - s.at > TYPEAHEAD_MS ? e.key : s.q + e.key;
      s.at = now;
      const from = state.open ? state.active : selected;
      const hit = typeahead(
        items.map((o) => o.label),
        s.q,
        from,
      );
      e.preventDefault();
      if (hit >= 0) setState({ open: true, active: hit });
      return;
    }
    // Space continues a type-ahead search ("New York") instead of picking.
    if (e.key === ' ' && Date.now() - search.current.at < TYPEAHEAD_MS) {
      e.preventDefault();
      search.current.q += ' ';
      return;
    }
    const r = selectKey(state, e, selected, items.length);
    if (r.handled) e.preventDefault();
    if (r.pick !== undefined) pick(r.pick);
    setState(r.state);
  };

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={listId}
        aria-activedescendant={state.open ? optionId(state.active) : undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setState({ open: !state.open, active: Math.max(0, selected) })}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[6px] border border-mnml-line bg-mnml-bg px-3 text-left text-sm text-mnml-text outline-none focus-visible:border-mnml-primary focus-visible:ring-2 focus-visible:ring-mnml-primary/20 aria-expanded:border-mnml-primary aria-invalid:border-mnml-danger disabled:cursor-default disabled:opacity-50 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${current === null ? 'text-mnml-text-mute' : ''}`}>{current ?? placeholder}</span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-mnml-text-mute" />
      </button>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        popover="manual"
        aria-label={listLabel}
        tabIndex={-1}
        className="max-h-72 overflow-y-auto rounded-[8px] border border-mnml-line bg-mnml-bg p-1 text-sm text-mnml-text shadow-lg [font-family:ui-sans-serif,system-ui,sans-serif]"
      >
        {items.map((o, i) => (
          <li
            key={o.value ?? '\0none'}
            id={optionId(i)}
            role="option"
            aria-selected={i === selected}
            // Keep focus on the button, so the keyboard keeps working after a click.
            onPointerDown={(e) => e.preventDefault()}
            onPointerMove={() => state.active !== i && setState({ open: true, active: i })}
            onClick={() => {
              pick(i);
              close();
              button.current?.focus();
            }}
            className={`flex cursor-pointer items-center gap-2 rounded-[4px] px-2.5 py-1.5 ${i === state.active ? 'bg-mnml-surface' : ''} ${o.value === null ? 'text-mnml-text-mute' : ''}`}
          >
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {i === selected && <CheckIcon aria-hidden className="size-3.5 shrink-0" />}
          </li>
        ))}
      </ul>
    </>
  );
}

export const Select = slotted('Select', SelectBase);
