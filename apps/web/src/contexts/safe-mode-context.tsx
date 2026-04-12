import type { ReactNode } from "react";

import { createContext, use, useCallback, useMemo, useState } from "react";

import type { DestructiveClassification } from "@/lib/safe-mode";

import { SafeModeConfirmDialog } from "@/components/workspace/safe-mode-confirm-dialog";
import { classifyDestructiveSql } from "@/lib/safe-mode";

interface PendingConfirmation {
  sql: string;
  classification: DestructiveClassification;
  resolve: (confirmed: boolean) => void;
}

interface SafeModeContextValue {
  enabled: boolean;
  toggle: () => void;
  requestConfirmation: (sql: string) => Promise<boolean>;
}

const SafeModeContext = createContext<SafeModeContextValue | null>(null);

export const SafeModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const requestConfirmation = useCallback(
    (sql: string): Promise<boolean> => {
      if (!enabled) {
        return Promise.resolve(true);
      }
      const classification = classifyDestructiveSql(sql);
      if (!classification) {
        return Promise.resolve(true);
      }
      const { promise, resolve } = Promise.withResolvers<boolean>();
      setPending({ classification, resolve, sql });
      return promise;
    },
    [enabled]
  );

  const resolvePending = useCallback(
    (confirmed: boolean) => {
      if (pending) {
        pending.resolve(confirmed);
        setPending(null);
      }
    },
    [pending]
  );

  const handleConfirm = useCallback(() => {
    resolvePending(true);
  }, [resolvePending]);

  const handleCancel = useCallback(() => {
    resolvePending(false);
  }, [resolvePending]);

  const value = useMemo(
    () => ({ enabled, requestConfirmation, toggle }),
    [enabled, requestConfirmation, toggle]
  );

  return (
    <SafeModeContext value={value}>
      {children}
      <SafeModeConfirmDialog
        classification={pending?.classification ?? null}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        sql={pending?.sql ?? null}
      />
    </SafeModeContext>
  );
};

export const useSafeMode = (): SafeModeContextValue => {
  const ctx = use(SafeModeContext);
  if (!ctx) {
    throw new Error("useSafeMode must be used within a SafeModeProvider");
  }
  return ctx;
};
