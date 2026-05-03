import type { DestructiveClassification } from "@oh-my-query/core/client";
import type { ReactNode } from "react";

import { classifyStandardSql } from "@oh-my-query/core/client";
import { getDestructiveClassifier } from "@oh-my-query/drivers/safe-mode";
import { createContext, use, useCallback, useMemo, useState } from "react";

import type { ConnectionEnvironment, DatabaseType } from "@/lib/connections";

import { SafeModeConfirmDialog } from "@/components/workspace/safe-mode-confirm-dialog";

interface ConfirmationContext {
  environment?: ConnectionEnvironment;
  connectionName?: string;
  connectionType?: DatabaseType;
}

export interface SafeModeConfirmationRequest {
  query: string;
  classification: DestructiveClassification;
  environment: ConnectionEnvironment | null;
  connectionName: string | null;
}

interface PendingConfirmation extends SafeModeConfirmationRequest {
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
    (query: string, context?: ConfirmationContext): Promise<boolean> => {
      if (context?.environment !== "prod" && !enabled) {
        return Promise.resolve(true);
      }

      const classify = context?.connectionType
        ? getDestructiveClassifier(context.connectionType)
        : classifyStandardSql;
      const classification = classify(query);

      if (!classification) {
        return Promise.resolve(true);
      }

      const { promise, resolve } = Promise.withResolvers<boolean>();
      setPending({
        classification,
        connectionName: context?.connectionName ?? null,
        environment: context?.environment ?? null,
        query,
        resolve,
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
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        request={
          pending
            ? {
                classification: pending.classification,
                connectionName: pending.connectionName,
                environment: pending.environment,
                query: pending.query,
              }
            : null
        }
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
