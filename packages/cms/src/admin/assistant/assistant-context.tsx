'use client';

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** The entry form the assistant can read and fill. `apply` puts values in the form and returns what they replaced. */
export type AssistantTarget = {
  key: string;
  slug?: string;
  values: unknown;
  apply: (values: Record<string, unknown>) => Record<string, unknown>;
};

type Value = {
  target: RefObject<AssistantTarget | null>;
  setTarget: (target: AssistantTarget | null) => void;
  label: string | null;
  setLabel: (label: string | null) => void;
};

// Without a provider (the assistant is off) registering is a no-op.
const AssistantContext = createContext<Value | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const target = useRef<AssistantTarget | null>(null);
  const setTarget = useCallback((t: AssistantTarget | null) => {
    target.current = t;
  }, []);
  const [label, setLabel] = useState<string | null>(null);
  return <AssistantContext value={{ target, setTarget, label, setLabel }}>{children}</AssistantContext>;
}

export const useAssistant = () => use(AssistantContext);

/**
 * An entry form registers itself while it is on screen, so the assistant knows the open page. The ref is updated on
 * every render (the panel reads the form's current values when a question is sent); only the label is state.
 */
export function useAssistantTarget(target: AssistantTarget, label: string) {
  const a = use(AssistantContext);
  const setTarget = a?.setTarget;
  const setLabel = a?.setLabel;
  useEffect(() => {
    setTarget?.(target);
  });
  useEffect(() => {
    setLabel?.(label);
    return () => {
      setTarget?.(null);
      setLabel?.(null);
    };
  }, [label, setTarget, setLabel]);
}
