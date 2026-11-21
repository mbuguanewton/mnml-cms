import type { ReactNode } from 'react';

// The props of each admin UI component ("slot"). Every built-in component takes exactly these, so a site's own
// component can stand in for one later without the admin changing.

export type ButtonProps = {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
  size?: 'default' | 'sm' | 'icon' | 'icon-sm' | 'icon-xs';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
};

type FieldBase = {
  id?: string;
  disabled?: boolean;
  /** Marks the control as failing validation (`aria-invalid`, red border). */
  invalid?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
};

export type InputProps = FieldBase & {
  value: string;
  onChange: (value: string) => void;
  /** Native types only; number, date and datetime-local are restyled, not replaced. */
  type?: 'text' | 'url' | 'email' | 'search' | 'password' | 'number' | 'date' | 'datetime-local';
  placeholder?: string;
  name?: string;
  readOnly?: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  inputMode?: 'text' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export type TextareaProps = FieldBase & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
};

export type SelectOption = { value: string; label: string };

export type SelectProps = FieldBase & {
  /** The picked option's value, or null for none. A value that isn't an option is shown as-is. */
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  /** Shown when nothing is picked. Default '—'. */
  placeholder?: string;
  /** Adds a first option that picks nothing (null). */
  clearable?: boolean;
};

export type CheckboxProps = {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Rendered next to the box, inside its <label>. Without it, label the control yourself (htmlFor / aria-label). */
  label?: ReactNode;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
};

export type SwitchProps = CheckboxProps;

export type ToastTone = 'info' | 'success' | 'danger';

export type ToastOptions = {
  title: string;
  description?: ReactNode;
  /** Default 'info'. 'danger' is announced assertively and stays longer. */
  tone?: ToastTone;
  /** Milliseconds before it closes. Default 4000 (8000 for 'danger'); 0 keeps it until dismissed. */
  duration?: number;
};

export type TooltipProps = {
  content: ReactNode;
  /** One focusable element (a button or link). The tooltip shows on hover and keyboard focus. */
  children: React.ReactElement;
  /** Default 'top'. Flips when there is no room. */
  side?: 'top' | 'bottom';
};
