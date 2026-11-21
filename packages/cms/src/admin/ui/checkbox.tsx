'use client';

import { CheckIcon } from 'lucide-react';
import type { CheckboxProps, SwitchProps } from './slots.js';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-mnml-bg';

/** Wraps a control in a <label> with its text, or returns it alone when there is none. */
function Labelled({ label, className, align, children }: { label: React.ReactNode; className: string; align: 'center' | 'start'; children: React.ReactNode }) {
  if (label === undefined || label === null) return <>{children}</>;
  return (
    <label
      className={`flex w-fit cursor-pointer gap-2 text-sm text-mnml-text has-disabled:cursor-default has-disabled:opacity-60 ${align === 'start' ? 'items-start' : 'items-center'} ${className}`}
    >
      {children}
      {/* The box sits on the first line of a longer label. */}
      <span className="min-w-0">{label}</span>
    </label>
  );
}

/** A native checkbox (focus, forms and screen readers as usual), drawn with the --mnml-* tokens. */
export function Checkbox({ id, checked, onChange, disabled, invalid, label, name, className = '', ...aria }: CheckboxProps) {
  return (
    <Labelled label={label} className={className} align="start">
      <span className={`relative inline-grid size-4 shrink-0 place-items-center ${label ? 'mt-0.5' : className}`}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.checked)}
          {...aria}
          className={`peer col-start-1 row-start-1 m-0 size-4 cursor-pointer appearance-none rounded-[4px] border border-mnml-text-mute bg-mnml-bg transition-colors checked:border-mnml-primary checked:bg-mnml-primary aria-invalid:border-mnml-danger disabled:cursor-default disabled:opacity-50 ${focusRing}`}
        />
        <CheckIcon
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none col-start-1 row-start-1 size-3 text-mnml-on-primary opacity-0 peer-checked:opacity-100"
        />
      </span>
    </Labelled>
  );
}

/** An on/off switch: a native checkbox with role="switch", so it's announced as on or off. */
export function Switch({ id, checked, onChange, disabled, invalid, label, name, className = '', ...aria }: SwitchProps) {
  return (
    <Labelled label={label} className={className} align="center">
      <span className={`relative inline-grid shrink-0 items-center ${label ? '' : className}`}>
        <input
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.checked)}
          {...aria}
          className={`peer col-start-1 row-start-1 m-0 h-[18px] w-8 cursor-pointer appearance-none rounded-full border border-mnml-line bg-mnml-surface transition-colors checked:border-mnml-primary checked:bg-mnml-primary aria-invalid:border-mnml-danger disabled:cursor-default disabled:opacity-50 ${focusRing}`}
        />
        <span
          aria-hidden
          className="pointer-events-none col-start-1 row-start-1 ml-[3px] size-3 rounded-full bg-mnml-text-mute shadow-sm transition-transform peer-checked:translate-x-[14px] peer-checked:bg-mnml-on-primary peer-disabled:opacity-50"
        />
      </span>
    </Labelled>
  );
}
