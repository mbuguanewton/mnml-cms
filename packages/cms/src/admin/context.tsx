'use client';

import { createContext, use } from 'react';
import { DialogProvider, useDialogs } from './confirm.js';

type AdminContextValue = { adminPath: string; apiPath: string };

const AdminContext = createContext<AdminContextValue>({ adminPath: '/admin', apiPath: '/api/mnml' });

export function AdminProvider({ value, children }: { value: AdminContextValue; children: React.ReactNode }) {
  return (
    <AdminContext value={value}>
      <DialogProvider>{children}</DialogProvider>
    </AdminContext>
  );
}

/** Admin and API paths, `post()` for calling the CMS route handler, and `confirm()` / `alert()` for dialogs. */
export function useAdmin() {
  const ctx = use(AdminContext);
  const dialogs = useDialogs();
  async function post<T>(route: string, body: unknown): Promise<T> {
    const res = await fetch(`${ctx.apiPath}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && json.ok === undefined) throw new Error(json.error ?? json.message ?? `Request failed (${res.status})`);
    return json as T;
  }
  return { ...ctx, ...dialogs, post };
}
