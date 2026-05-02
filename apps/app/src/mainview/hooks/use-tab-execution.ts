import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { QueryTab } from "@/lib/query-types";

import { useConnection } from "@/contexts/connection-context";
import { useSafeMode } from "@/contexts/safe-mode-context";
import { appendHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";
import { cancelQuery, executeQuery } from "@/lib/tauri";

const isCancellationError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code } = error as { code?: unknown };
  return code === "QUERY_CANCELLED";
};

const HISTORY_ERROR_TOAST_THROTTLE_MS = 10_000;

interface ExtractedError {
  message: string;
  code: string | null;
}

const extractError = (error: unknown): ExtractedError => {
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    const code = typeof obj.code === "string" ? obj.code : null;
    if ("message" in obj) {
      return { code, message: String(obj.message) };
    }
  }
  if (error instanceof Error) {
    return { code: null, message: error.message };
  }
  return { code: null, message: "Query execution failed" };
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
  const { requestConfirmation } = useSafeMode();
  const { connection } = useConnection();

  const execute = useCallback(
    async (
      tabId: string,
      sql: string,
      sourceDialect?: string | null,
      maxRows?: number
    ) => {
      const confirmed = await requestConfirmation(sql, {
        connectionName: connection.name,
        connectionType: connection.type,
        environment: connection.environment,
        perConnectionEnabled: connection.safeModeEnabled ?? true,
      });
      if (!confirmed) {
        return;
      }

      const queryId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                error: null,
                errorCode: null,
                executedSql: null,
                pendingExecution: {
                  database: selectedDatabase,
                  sourceDialect: sourceDialect ?? null,
                  sql,
                  startedAt,
                },
                result: null,
                runningQueryId: queryId,
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
      let cancelled = false;

      try {
        const result = await executeQuery({
          connectionId,
          maxRows,
          queryId,
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
                  errorCode: null,
                  executedSql: sql,
                  pendingExecution: null,
                  result,
                  runningQueryId: null,
                  status: "success" as const,
                }
              : t
          )
        );
      } catch (error) {
        cancelled = isCancellationError(error);
        const extracted = extractError(error);
        const message = cancelled ? "Query cancelled" : extracted.message;
        errorMessage = message;
        executionTimeMs = Math.round(performance.now() - startTime);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  error: cancelled ? null : message,
                  errorCode: cancelled ? null : (extracted.code ?? null),
                  executedSql: sql,
                  pendingExecution: null,
                  result: null,
                  runningQueryId: null,
                  status: cancelled ? ("idle" as const) : ("error" as const),
                }
              : t
          )
        );
        if (cancelled) {
          toast.info("Query cancelled");
        }
      }

      try {
        await appendHistory({
          connectionId,
          database: selectedDatabase,
          dialect: connection.type,
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
    [
      connection.environment,
      connection.name,
      connection.safeModeEnabled,
      connection.type,
      connectionId,
      selectedDatabase,
      setTabs,
      flushSave,
      requestConfirmation,
    ]
  );

  const cancel = useCallback(async (queryId: string) => {
    try {
      await cancelQuery(queryId);
    } catch {
      toast.error("Couldn't cancel query");
    }
  }, []);

  return { cancel, execute };
};
