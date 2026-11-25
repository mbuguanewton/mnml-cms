'use client';

// The site's own components in the admin (the `ui` option). Only Select is swapped; every other slot stays built-in.
import { uiProvider, type UiSlotProps } from '@n3wtou/mnml-cms/admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Radix items can't have an empty value, so "no value" (null) gets its own sentinel.
const NONE = '__none__';

function AdminSelect({ id, value, onChange, options, placeholder = '—', clearable, disabled, invalid, className, ...aria }: UiSlotProps['Select']) {
  const label = value === null ? placeholder : (options.find((o) => o.value === value)?.label ?? `${value} (unavailable)`);
  return (
    <Select value={value ?? (clearable ? NONE : '')} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      {/* id and aria-* on the trigger, so the field's <label htmlFor> still names it. */}
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={className} {...aria}>
        {/* The label given directly: Radix would otherwise show nothing until the list has been opened once. */}
        <SelectValue placeholder={placeholder}>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {clearable && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {value !== null && !options.some((o) => o.value === value) && <SelectItem value={value}>{`${value} (unavailable)`}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const AdminUi = uiProvider({ Select: AdminSelect });
