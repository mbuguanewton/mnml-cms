'use client';

import { createContext, use } from 'react';

type AdminContextValue = { adminPath: string; apiPath: string };

const AdminContext = createContext<AdminContextValue>({ adminPath: '/admin', apiPath: '/api/cms' });

export function AdminProvider({ value, children }: { value: AdminContextValue; children: React.ReactNode }) {
  return <AdminContext value={value}>{children}</AdminContext>;
}

/** Admin and API paths, and `post()` for calling the CMS route handler. */
export function useAdmin() {
  const ctx = use(AdminContext);
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
  return { ...ctx, post };
}
