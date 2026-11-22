'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { PortalHost, slotted } from './context.js';
import { monthGrid, moveDay, parseDate, parseDateTime, sameMonth, shiftMonth, today, weekStartFor, type WeekStart } from './calendar.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { placePopover } from './position.js';
import { Select } from './select.js';
import type { DatePickerProps } from './slots.js';
import { Tooltip } from './tooltip.js';

// Touch screens keep the browser's own picker: phone pickers beat a small grid.
const coarseQuery = '(pointer: coarse)';
const subscribeCoarse = (onChange: () => void) => {
  const m = window.matchMedia(coarseQuery);
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
};
const isCoarse = () => window.matchMedia(coarseQuery).matches;

/**
 * A date (or date and time) field: type `YYYY-MM-DD`, or pick from a calendar (WAI-ARIA date picker dialog: arrows,
 * Home/End, PageUp/PageDown by month, with Shift by year, Enter to pick, Escape to close). Native picker on touch.
 */
function DatePickerBase({
  id,
  value,
  onChange,
  time,
  timeInCalendar,
  disabled,
  invalid,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: DatePickerProps) {
  const coarse = useSyncExternalStore(subscribeCoarse, isCoarse, () => false);
  const errorId = useId();
  const row = useRef<HTMLDivElement>(null);
  const date = value ? value.slice(0, 10) : '';
  const clock = time && value ? value.slice(11, 16) : '';

  // One box for date and time: the time is picked in the calendar.
  const combined = !!time && !!timeInCalendar;
  const shown = combined && date ? `${date} ${clock}` : date;

  // What's typed; follows the value when it changes from outside (a pick, a reset).
  const [text, setText] = useState(shown);
  const [shownText, setShownText] = useState(shown);
  if (shown !== shownText) {
    setShownText(shown);
    setText(shown);
  }
  const bad = text.trim() !== '' && (combined ? parseDateTime(text) === null : parseDate(text) === null);
  const format = combined ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';

  // The time box is named after the field: its aria-label, else the text of its <label for={id}>. Set on the DOM,
  // since the label is only readable after render.
  const timeBox = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const text = ariaLabel ?? (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : undefined);
    timeBox.current?.querySelector('[role=group]')?.setAttribute('aria-label', text ? `${text} time` : 'Time');
  }, [id, ariaLabel, time, coarse]);

  const commit = (d: string | null, t = clock) => onChange(d ? (time ? `${d}T${t || '00:00'}` : d) : null);

  if (coarse)
    return (
      <Input
        id={id}
        type={time ? 'datetime-local' : 'date'}
        value={time ? (value ?? '') : date}
        onChange={(v) => onChange(v || null)}
        disabled={disabled}
        invalid={invalid}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={className}
      />
    );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div ref={row} className="flex w-fit max-w-full items-center gap-1.5">
        <Input
          id={id}
          value={text}
          placeholder={format}
          inputMode="numeric"
          maxLength={combined ? 16 : 10}
          autoComplete="off"
          disabled={disabled}
          invalid={invalid || bad}
          aria-label={ariaLabel}
          aria-describedby={[describedBy, bad ? errorId : null].filter(Boolean).join(' ') || undefined}
          onChange={(v) => {
            setText(v);
            if (v.trim() === '') commit(null);
            else if (combined) {
              // A date alone keeps the current time.
              const dt = parseDateTime(v);
              if (dt) commit(dt.date, dt.time ?? clock);
            } else {
              const d = parseDate(v);
              if (d) commit(d);
            }
          }}
          className={`${combined ? 'max-w-44' : 'max-w-36'} tabular-nums`}
        />
        <Calendar
          value={date || null}
          disabled={disabled}
          anchor={row}
          onPick={(d) => commit(d)}
          time={combined ? { value: clock, onChange: (t) => date && commit(date, t) } : undefined}
        />
        {time && !combined && (
          <span ref={timeBox} className="contents">
            <TimeSelect value={clock} disabled={disabled || !date} onChange={(t) => date && commit(date, t)} />
          </span>
        )}
      </div>
      {bad && (
        <p id={errorId} className="text-xs text-mnml-danger">
          Use {format}
        </p>
      )}
    </div>
  );
}

/** The calendar button and its popover grid. */
function Calendar({
  value,
  disabled,
  anchor,
  onPick,
  time,
}: {
  value: string | null;
  disabled?: boolean;
  /** The field's row: the calendar lines up with its left edge. */
  anchor: React.RefObject<HTMLDivElement | null>;
  onPick: (date: string) => void;
  /** A time row under the grid: picking a day then keeps the calendar open and moves on to the time. */
  time?: { value: string; onChange: (time: string) => void };
}) {
  const timeInput = useRef<HTMLSpanElement>(null);
  const timeId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value ?? today());
  const locale = typeof navigator === 'undefined' ? 'en' : navigator.language;
  const weekStartsOn = useMemo<WeekStart>(() => weekStartFor(locale), [locale]);
  const weeks = monthGrid(focused, weekStartsOn);
  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
      full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
      day: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
    }),
    [locale],
  );
  // Noon, so a formatter never lands on the day before because of a time zone.
  const at = (iso: string) => new Date(`${iso}T12:00:00`);
  const now = today();

  const show = () => {
    setFocused(value ?? today());
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (d: string) => {
    onPick(d);
    // After the pick re-renders (the time box is disabled until there is a day).
    if (time) setTimeout(() => timeInput.current?.querySelector('button')?.focus(), 0);
    else close(true);
  };

  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !button.current) return;
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return;
    }
    if (!el.matches(':popover-open')) el.showPopover();
    placePopover(el, anchor.current ?? button.current, { align: 'start' });
  }, [open, anchor]);

  // The focused day takes keyboard focus (roving tabindex), also after a month change.
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  // While open: close on a press outside, follow the button on scroll and resize.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      // A time list open inside the calendar dismisses itself first. A site's Select (Radix) also turns off pointer
      // events on the page meanwhile, so the press that closes the list lands outside the calendar.
      if (pop.current?.querySelector('[aria-expanded="true"]')) return;
      if (!button.current?.contains(t) && !pop.current?.contains(t)) close(false);
    };
    const follow = (e: Event) => {
      if (e.target instanceof Node && pop.current?.contains(e.target)) return;
      if (pop.current && button.current) placePopover(pop.current, anchor.current ?? button.current, { align: 'start' });
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open, anchor]);

  const onGridKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focused);
      return;
    }
    const next = moveDay(focused, e.key, { shift: e.shiftKey, weekStartsOn });
    if (next) {
      e.preventDefault();
      setFocused(next);
    }
  };

  const navButton = 'flex size-7 items-center justify-center rounded-[6px] text-mnml-text-soft mnml-state [&_svg]:size-4';

  return (
    <>
      <Tooltip content="Choose date">
        <button
          ref={button}
          type="button"
          aria-label="Choose date"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => (open ? close(true) : show())}
          className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-mnml-line bg-mnml-bg text-mnml-text-soft mnml-state disabled:opacity-50 aria-expanded:border-mnml-primary [&_svg]:size-4"
        >
          <CalendarIcon />
        </button>
      </Tooltip>
      <div
        ref={pop}
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        popover="manual"
        onKeyDown={(e) => {
          // Not when a time select inside already closed its own list with it.
          if (e.key !== 'Escape' || e.defaultPrevented) return;
          // Handled here, so a dialog or fullscreen editor around the field stays open.
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null;
          if (open && to && !pop.current?.contains(to) && !button.current?.contains(to)) close(false);
        }}
        className="w-72 rounded-[8px] border border-mnml-line bg-mnml-bg p-2 text-sm text-mnml-text shadow-lg [font-family:ui-sans-serif,system-ui,sans-serif]"
      >
        <PortalHost active={open}>
          {/* Rendered only while open: month names and "today" depend on the browser, which the server can't know. */}
          {open && (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <button type="button" aria-label="Previous month" onClick={() => setFocused(shiftMonth(focused, -1))} className={navButton}>
                  <ChevronLeftIcon />
                </button>
                <h2 id={headingId} aria-live="polite" className="text-sm font-semibold [font-family:inherit]">
                  {fmt.month.format(at(focused))}
                </h2>
                <button type="button" aria-label="Next month" onClick={() => setFocused(shiftMonth(focused, 1))} className={navButton}>
                  <ChevronRightIcon />
                </button>
              </div>
              <table ref={grid} role="grid" aria-labelledby={headingId} onKeyDown={onGridKey} className="w-full border-collapse text-center">
                <thead>
                  <tr>
                    {weeks[0].map((d) => (
                      <th key={d} scope="col" abbr={fmt.weekdayLong.format(at(d))} className="pb-1 text-xs font-normal text-mnml-text-mute">
                        {fmt.weekday.format(at(d))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week[0]}>
                      {week.map((d) => {
                        const selected = d === value;
                        const outside = !sameMonth(d, focused);
                        return (
                          <td key={d} role="gridcell" aria-selected={selected} className="p-0.5">
                            <button
                              type="button"
                              data-date={d}
                              tabIndex={d === focused ? 0 : -1}
                              aria-label={fmt.full.format(at(d))}
                              aria-current={d === now ? 'date' : undefined}
                              onClick={() => pick(d)}
                              className={`flex h-8 w-full items-center justify-center rounded-[6px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary/40 ${
                                selected
                                  ? 'bg-mnml-primary text-mnml-on-primary'
                                  : outside
                                    ? 'text-mnml-text-mute hover:bg-mnml-surface'
                                    : 'hover:bg-mnml-surface'
                              } ${d === now && !selected ? 'font-semibold underline underline-offset-4' : ''}`}
                            >
                              {fmt.day.format(at(d))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {time && (
                <div className="mt-2 flex items-center gap-2 border-t border-mnml-line pt-2">
                  <span id={timeId} className="text-xs text-mnml-text-mute">
                    Time
                  </span>
                  <span ref={timeInput} className="contents">
                    <TimeSelect labelId={timeId} value={time.value} disabled={!value} onChange={time.onChange} />
                  </span>
                  <Button size="sm" className="ml-auto" onClick={() => close(true)}>
                    Done
                  </Button>
                </div>
              )}
            </>
          )}
        </PortalHost>
      </div>
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: pad(i), label: pad(i) }));
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ value: pad(i), label: pad(i) }));

/** A time as two of the admin's selects (hour, minute): no native time popup, and a site's Select slot applies. */
function TimeSelect({
  value,
  onChange,
  disabled,
  labelId,
}: {
  /** `HH:mm`, or '' when empty. */
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  /** The element that names the group ("Time"); without it, the caller sets the group's aria-label. */
  labelId?: string;
}) {
  const [h, m] = value ? value.split(':') : [null, null];
  return (
    <span role="group" aria-labelledby={labelId} className="flex items-center gap-1">
      <Select
        aria-label="Hour"
        value={h}
        placeholder="--"
        options={HOURS}
        disabled={disabled}
        onChange={(v) => v && onChange(`${v}:${m ?? '00'}`)}
        className="max-w-18 tabular-nums"
      />
      <span aria-hidden className="text-mnml-text-mute">
        :
      </span>
      <Select
        aria-label="Minute"
        value={m}
        placeholder="--"
        options={MINUTES}
        disabled={disabled}
        onChange={(v) => v && onChange(`${h ?? '00'}:${v}`)}
        className="max-w-18 tabular-nums"
      />
    </span>
  );
}

/** The admin's date picker, or the site's `DatePicker` slot. */
export const DatePicker = slotted('DatePicker', DatePickerBase);
