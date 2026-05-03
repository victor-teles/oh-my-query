import type { ReactNode } from "react";

import { createContext, use, useCallback, useMemo, useState } from "react";

import type { ConnectionEnvironment, DatabaseType } from "@/lib/connections";
import type { DestructiveClassification } from "@/lib/safe-mode";

import { SafeModeConfirmDialog } from "@/components/workspace/safe-mode-confirm-dialog";
import { classifyDestructiveSql } from "@/lib/safe-mode";

interface ConfirmationContext {
  environment?: ConnectionEnvironment;
  connectionName?: string;
  connectionType?: DatabaseType;
}

interface PendingConfirmation {
  sql: string;
  classification: DestructiveClassification;
  environment: ConnectionEnvironment | null;
  connectionName: string | null;
  resolve: (confirmed: boolean) => void;
}

interface SafeModeContextValue {
  enabled: boolean;
  toggle: () => void;
  requestConfirmation: (
    sql: string,
    context?: ConfirmationContext
  ) => Promise<boolean>;
}

const SafeModeContext = createContext<SafeModeContextValue | null>(null);

export const SafeModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const requestConfirmation = useCallback(
    (sql: string, context?: ConfirmationContext): Promise<boolean> => {
      if (context?.environment !== "prod" && !enabled) {
        return Promise.resolve(true);
      }

      const classification = classifyDestructiveSql(
        sql,
        context?.connectionType
      );
      if (!classification) {
        return Promise.resolve(true);
      }

      const { promise, resolve } = Promise.withResolvers<boolean>();
      setPending({
        classification,
        connectionName: context?.connectionName ?? null,
        environment: context?.environment ?? null,
        resolve,
        sql,
      });
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
        connectionName={pending?.connectionName ?? null}
        environment={pending?.environment ?? null}
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
