'use client';

// The site's own components in the admin (the `ui` option). Select is swapped for the site's shadcn one, and the
// assistant's replies are shown with react-markdown; every other slot stays built-in.
import ReactMarkdown from 'react-markdown';
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

// The assistant's replies with react-markdown instead of the built-in renderer. It does not render raw HTML. The
// admin's Tailwind reset removes list markers and spacing, so those are put back here.
function AdminMarkdown({ text }: UiSlotProps['Markdown']) {
  return (
    <div className="flex flex-col gap-2 break-words">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-mnml-surface p-3 text-xs">{children}</pre>,
          code: ({ children }) => <code className="rounded bg-mnml-surface px-1 font-mono text-[0.85em]">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const AdminUi = uiProvider({ Select: AdminSelect, Markdown: AdminMarkdown });
