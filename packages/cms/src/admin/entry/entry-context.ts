'use client';

import { createContext, use, type ReactNode } from 'react';

/** What the entry form shares with fields that leave it, e.g. the fullscreen editor's header. */
export const EntryContext = createContext<{ title: string; status: ReactNode } | null>(null);

export const useEntry = () => use(EntryContext);
