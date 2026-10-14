'use client';

import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './button.js';

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** Default 'Confirm'. */
  confirmLabel?: string;
  /** Default 'Cancel'. `false` hides the cancel button (an alert). */
  cancelLabel?: string | false;
  /** Styles the confirm button as destructive, and focuses Cancel first. */
  danger?: boolean;
};

type Dialogs = {
  /** Resolves true if the user confirms, false if they cancel, press Escape or click outside. */
  confirm(o: ConfirmOptions): Promise<boolean>;
  /** A message with a single OK button. */
  alert(o: Omit<ConfirmOptions, 'cancelLabel'>): Promise<void>;
};

const DialogContext = createContext<Dialogs>({
  confirm: async (o) => window.confirm(o.title),
  alert: async (o) => window.alert(o.title),
});

export const useDialogs = () => use(DialogContext);

/** Renders one modal `<dialog>` for the whole admin; `useAdmin().confirm()` opens it. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const focus = useRef<HTMLButtonElement>(null);
  const settle = useRef<((ok: boolean) => void) | null>(null);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        settle.current?.(false); // a dialog is already open: dismiss it
        settle.current = resolve;
        setOpts(o);
      }),
    [],
  );
  const alert = useCallback(async (o: Omit<ConfirmOptions, 'cancelLabel'>) => void (await confirm({ confirmLabel: 'OK', ...o, cancelLabel: false })), [confirm]);

  useEffect(() => {
    if (!opts) return;
    dialog.current?.showModal();
    focus.current?.focus();
  }, [opts]);

  const close = (ok: boolean) => {
    dialog.current?.close();
    settle.current?.(ok);
    settle.current = null;
    setOpts(null);
  };

  return (
    <DialogContext value={{ confirm, alert }}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="mnml-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        // A click on the backdrop lands on the dialog element itself, not on its content.
        onClick={(e) => e.target === e.currentTarget && close(false)}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-[10px] border border-mnml-line bg-mnml-bg p-0 text-sm text-mnml-text shadow-xl backdrop:bg-black/40 [font-family:ui-sans-serif,system-ui,sans-serif]"
        // Tailwind's reset removes the browser's auto margins, which is what centers a modal dialog.
        style={{ margin: 'auto' }}
      >
        {opts && (
          <div className="flex flex-col gap-4" style={{ padding: 20 }}>
            <div className="flex flex-col gap-1.5">
              <h2 id="mnml-dialog-title" className="text-base font-semibold [font-family:inherit]">
                {opts.title}
              </h2>
              {opts.description && <div className="text-mnml-text-soft">{opts.description}</div>}
            </div>
            <div className="flex justify-end gap-2">
              {opts.cancelLabel !== false && (
                <Button ref={opts.danger ? focus : undefined} type="button" variant="outline" onClick={() => close(false)}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Button>
              )}
              <Button ref={opts.danger ? undefined : focus} type="button" variant={opts.danger ? 'destructive' : 'default'} onClick={() => close(true)}>
                {opts.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </DialogContext>
  );
}
