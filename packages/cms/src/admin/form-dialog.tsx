'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { objectSchema, withDefaults } from '../define.js';
import type { FormOptions, NodeFormFields, ToolContext } from '../editor.js';
import { Button } from './button.js';
import { FieldRenderer, type Errors } from './fields.js';
import { FormContext } from './form-context.js';

/** Validates a form's values like an entry's; returns the parsed values, or the errors by field. */
export function validateForm(
  fields: NodeFormFields,
  values: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Errors } {
  const r = objectSchema(fields).safeParse(values);
  if (r.success) return { ok: true, data: r.data as Record<string, unknown> };
  const errors: Errors = {};
  for (const i of r.error.issues) errors[i.path.join('.')] ??= i.message;
  return { ok: false, errors };
}

/** Renders one modal form `<dialog>` for the whole admin; `useForm()` opens it. */
export function FormDialogProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const settle = useRef<((v: Record<string, unknown> | null) => void) | null>(null);
  const [opts, setOpts] = useState<FormOptions<NodeFormFields> | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Errors>({});

  const form = useCallback(
    (o: FormOptions<NodeFormFields>) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        settle.current?.(null); // a form is already open: dismiss it
        settle.current = resolve;
        // Only this form's fields, filled in from the given values.
        setValues(withDefaults(o.fields, o.values ?? {}) as Record<string, unknown>);
        setErrors({});
        setOpts(o);
      }),
    [],
  ) as ToolContext['form'];

  useEffect(() => {
    if (!opts) return;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [opts]);

  const close = (result: Record<string, unknown> | null) => {
    dialog.current?.close();
    settle.current?.(result);
    settle.current = null;
    setOpts(null);
  };

  const submit = () => {
    if (!opts) return;
    const r = validateForm(opts.fields, values);
    if (r.ok) close(r.data);
    else setErrors(r.errors);
  };

  return (
    <FormContext value={form}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="mnml-form-title"
        onCancel={(e) => {
          e.preventDefault();
          close(null);
        }}
        onClick={(e) => e.target === e.currentTarget && close(null)}
        className="w-[min(30rem,calc(100vw-2rem))] rounded-[10px] border border-mnml-line bg-mnml-bg p-0 text-sm text-mnml-text shadow-xl backdrop:bg-black/40 [font-family:ui-sans-serif,system-ui,sans-serif]"
        style={{ margin: 'auto' }}
      >
        {opts && (
          <form
            noValidate
            className="flex flex-col gap-4"
            style={{ padding: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              // The dialog is outside the entry form in the DOM, but React bubbles events through the component tree.
              e.stopPropagation();
              submit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <h2 id="mnml-form-title" className="text-base font-semibold [font-family:inherit]">
                {opts.title}
              </h2>
              {opts.description && <p className="text-mnml-text-soft">{opts.description}</p>}
            </div>
            {Object.entries(opts.fields).map(([key, field]) => (
              <FieldRenderer
                key={key}
                field={field}
                value={values[key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                path={`mnml-form.${key}`}
                errors={Object.fromEntries(Object.entries(errors).map(([k, m]) => [`mnml-form.${k}`, m]))}
                siblings={values}
              />
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => close(null)}>
                Cancel
              </Button>
              <Button type="submit">{opts.submitLabel ?? 'Save'}</Button>
            </div>
          </form>
        )}
      </dialog>
    </FormContext>
  );
}
