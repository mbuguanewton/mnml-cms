'use client';

import { createContext, use, useCallback } from 'react';
import { DialogProvider, useDialogs } from './confirm.js';
import { ToastProvider, useToasts } from '../ui/toast.js';

/** `mediaLibrary`: the media storage can list its files, so the image picker can offer them. */
type AdminContextValue = { adminPath: string; apiPath: string; mediaLibrary?: boolean };

const AdminContext = createContext<AdminContextValue>({ adminPath: '/admin', apiPath: '/api/mnml' });

export function AdminProvider({ value, children }: { value: AdminContextValue; children: React.ReactNode }) {
  return (
    <AdminContext value={value}>
      <ToastProvider>
        <DialogProvider>{children}</DialogProvider>
      </ToastProvider>
    </AdminContext>
  );
}

/** Admin and API paths, `post()` for calling the CMS route handler, `confirm()` / `alert()` for dialogs and `toast()`. */
export function useAdmin() {
  const ctx = use(AdminContext);
  const dialogs = useDialogs();
  const toasts = useToasts();
  // Stable across renders, so effects can depend on it.
  const post = useCallback(
    async <T,>(route: string, body: unknown): Promise<T> => {
      const res = await fetch(`${ctx.apiPath}/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && json.ok === undefined) throw new Error(json.error ?? json.message ?? `Request failed (${res.status})`);
      return json as T;
    },
    [ctx.apiPath],
  );
  return { ...ctx, ...dialogs, ...toasts, post };
}
