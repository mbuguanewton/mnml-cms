'use client';

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** The entry form the assistant can read and fill. `apply` puts values in the form and returns what they replaced. */
export type AssistantTarget = {
  key: string;
  slug?: string;
  values: unknown;
  apply: (values: Record<string, unknown>) => Record<string, unknown>;
};

/** The open entry: what the panel says it is looking at, and the id its earlier chats are kept under. */
export type AssistantPage = { label: string; id: string };

type Value = {
  target: RefObject<AssistantTarget | null>;
  setTarget: (target: AssistantTarget | null) => void;
  page: AssistantPage | null;
  setPage: (page: AssistantPage | null) => void;
};

// Without a provider (the assistant is off) registering is a no-op.
const AssistantContext = createContext<Value | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const target = useRef<AssistantTarget | null>(null);
  const setTarget = useCallback((t: AssistantTarget | null) => {
    target.current = t;
  }, []);
  const [page, setPage] = useState<AssistantPage | null>(null);
  return <AssistantContext value={{ target, setTarget, page, setPage }}>{children}</AssistantContext>;
}

export const useAssistant = () => use(AssistantContext);

/**
 * An entry form registers itself while it is on screen, so the assistant knows the open page. The ref is updated on
 * every render (the panel reads the form's current values when a question is sent); only the page is state.
 */
export function useAssistantTarget(target: AssistantTarget, label: string) {
  const a = use(AssistantContext);
  const setTarget = a?.setTarget;
  const setPage = a?.setPage;
  const id = `${target.key}/${target.slug ?? ''}`;
  useEffect(() => {
    setTarget?.(target);
  });
  useEffect(() => {
    setPage?.({ label, id });
    return () => {
      setTarget?.(null);
      setPage?.(null);
    };
  }, [label, id, setTarget, setPage]);
}
