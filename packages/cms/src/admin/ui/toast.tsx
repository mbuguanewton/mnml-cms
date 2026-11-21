'use client';

import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, XIcon } from 'lucide-react';
import type { ToastOptions } from './slots.js';

type Toast = ToastOptions & { id: number };

type Toasts = {
  /** Shows a short message in the corner and announces it to screen readers. Returns its id, for `dismiss`. */
  toast: (o: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<Toasts>({ toast: () => 0, dismiss: () => {} });

export const useToasts = () => use(ToastContext);

// The newest few are shown; older ones close early.
const MAX = 3;
const icons = { info: InfoIcon, success: CircleCheckIcon, danger: CircleAlertIcon };

/**
 * Renders the admin's toasts. Two live regions stay mounted (polite, and assertive for 'danger'), so screen readers
 * announce what is added to them.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback((o: ToastOptions) => {
    const id = next.current++;
    setToasts((ts) => [...ts, { ...o, id }].slice(-MAX));
    return id;
  }, []);

  const region = (assertive: boolean) => (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      // Not display: contents, which drops the live region from some browsers' accessibility trees.
      className="flex w-full flex-col items-center gap-2 sm:items-end"
    >
      {toasts
        .filter((t) => (t.tone === 'danger') === assertive)
        .map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
    </div>
  );

  return (
    <ToastContext value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 text-sm [font-family:ui-sans-serif,system-ui,sans-serif] sm:items-end">
        {region(false)}
        {region(true)}
      </div>
    </ToastContext>
  );
}

function ToastItem({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  const tone = t.tone ?? 'info';
  const duration = t.duration ?? (tone === 'danger' ? 8000 : 4000);
  const [paused, setPaused] = useState(false);
  const Icon = icons[tone];
  // The latest onClose, so a parent re-render doesn't restart the timer.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Hovering or focusing the toast keeps it open, so it can be read.
  useEffect(() => {
    if (!duration || paused) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, paused]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-[min(22rem,100%)] items-start gap-2.5 rounded-[8px] border border-mnml-line bg-mnml-bg py-2.5 pl-3 pr-2 text-mnml-text shadow-lg"
    >
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${tone === 'danger' ? 'text-mnml-danger' : tone === 'success' ? 'text-mnml-success' : 'text-mnml-text-mute'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium break-words">{t.title}</p>
        {t.description && <div className="break-words text-mnml-text-soft">{t.description}</div>}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="mnml-state flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-mnml-text-mute"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
