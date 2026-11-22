'use client';

import { PortalHost } from './ui-context.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialValues, objectSchema, withDefaults } from '../define.js';
import type { FormOptions, NodeFormFields, ToolContext } from '../editor.js';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { FieldRenderer, RefOptionsProvider, type Errors, type RefOptions } from './fields.js';
import { FormContext } from './form-context.js';
import { fetchRefOptions } from './ref-options.js';

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
  const [refOptions, setRefOptions] = useState<RefOptions>({});
  const { post } = useAdmin();

  const form = useCallback(
    (o: FormOptions<NodeFormFields>) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        settle.current?.(null); // a form is already open: dismiss it
        settle.current = resolve;
        // Editing fills in the given values; inserting starts from the fields' defaults.
        setValues((o.values ? withDefaults(o.fields, o.values) : initialValues(o.fields)) as Record<string, unknown>);
        setErrors({});
        setOpts(o);
      }),
    [],
  ) as ToolContext['form'];

  // Reference fields offer published entries, fetched fresh each time a form opens.
  useEffect(() => {
    const collections = opts ? [...new Set(Object.values(opts.fields).flatMap((f) => (f.type === 'reference' ? [f.collection] : [])))] : [];
    if (!collections.length) return;
    let live = true;
    void fetchRefOptions(post, collections, true).then((o) => live && setRefOptions(o));
    return () => {
      live = false;
    };
  }, [opts, post]);

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
        <PortalHost>
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
              <RefOptionsProvider value={refOptions}>
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
              </RefOptionsProvider>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => close(null)}>
                  Cancel
                </Button>
                <Button type="submit">{opts.submitLabel ?? 'Save'}</Button>
              </div>
            </form>
          )}
        </PortalHost>
      </dialog>
    </FormContext>
  );
}
