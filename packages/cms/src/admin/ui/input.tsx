'use client';

import { inputClass } from '../styles.js';
import type { InputProps, TextareaProps } from './slots.js';

// Number, date and datetime-local keep the browser's own input (its keyboard and pickers); styles.css evens out
// how they look across browsers (no spinners, a quiet calendar icon, dark-mode pickers).
const narrow = new Set(['number', 'date', 'datetime-local']);

/** A text input that reports its value, not the event. */
export function Input({ value, onChange, invalid, type = 'text', className = '', ...rest }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={`${inputClass} ${narrow.has(type) ? 'w-auto' : ''} ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ value, onChange, invalid, rows = 4, className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={`${inputClass} ${className}`}
      {...rest}
    />
  );
}
