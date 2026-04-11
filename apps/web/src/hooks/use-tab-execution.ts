import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { QueryTab } from "@/lib/query-types";

import { appendHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";
import { executeQuery } from "@/lib/tauri";

const HISTORY_ERROR_TOAST_THROTTLE_MS = 10_000;

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Query execution failed";
};

interface UseTabExecutionParams {
  connectionId: string;
  selectedDatabase: string | null;
  setTabs: React.Dispatch<React.SetStateAction<QueryTab[]>>;
  flushSave: () => Promise<void>;
}

export const useTabExecution = ({
  connectionId,
  selectedDatabase,
  setTabs,
  flushSave,
}: UseTabExecutionParams) => {
  const lastHistoryErrorToastRef = useRef(0);

  const execute = useCallback(
    async (tabId: string, sql: string, sourceDialect?: string | null) => {
      const startedAt = new Date().toISOString();
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                error: null,
                executedSql: null,
                pendingExecution: {
                  database: selectedDatabase,
                  sourceDialect: sourceDialect ?? null,
                  sql,
                  startedAt,
                },
                result: null,
                status: "running" as const,
              }
            : t
        )
      );

      await flushSave();

      const startTime = performance.now();
      let success = false;
      let errorMessage: string | null = null;
      let executionTimeMs = 0;

      try {
        const result = await executeQuery({
          connectionId,
          schema: selectedDatabase ?? undefined,
          sourceDialect: sourceDialect ?? undefined,
          sql,
        });
        ({ executionTimeMs } = result);
        success = true;
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  error: null,
                  executedSql: sql,
                  pendingExecution: null,
                  result,
                  status: "success" as const,
                }
              : t
          )
        );
      } catch (error) {
        const message = extractErrorMessage(error);
        errorMessage = message;
        executionTimeMs = Math.round(performance.now() - startTime);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  error: message,
                  pendingExecution: null,
                  result: null,
                  status: "error" as const,
                }
              : t
          )
        );
      }

      try {
        await appendHistory({
          connectionId,
          database: selectedDatabase,
          error: errorMessage,
          executionTimeMs,
          sql,
          success,
          timestamp: new Date().toISOString(),
        });
        window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
      } catch {
        const now = Date.now();
        if (
          now - lastHistoryErrorToastRef.current >
          HISTORY_ERROR_TOAST_THROTTLE_MS
        ) {
          lastHistoryErrorToastRef.current = now;
          toast.error("Couldn't save query history", {
            description: "The query ran, but it wasn't added to history.",
          });
        }
      }
    },
    [connectionId, selectedDatabase, setTabs, flushSave]
  );

  return { execute };
};
