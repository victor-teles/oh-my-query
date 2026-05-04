import { useCallback, useRef } from "react";

import type { QueryTab } from "@/lib/query-types";

import { useConnection } from "@/contexts/connection-context";
import { useSafeMode } from "@/contexts/safe-mode-context";
import { resolveRunConfig } from "@/lib/connections";
import { appendHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";
import { cancelQuery, executeQuery } from "@/lib/tauri";

const isCancellationError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code } = error as { code?: unknown };
  return code === "QUERY_CANCELLED";
};

const HISTORY_ERROR_LOG_THROTTLE_MS = 10_000;

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

export interface ExecuteOptions {
  sourceDialect?: string | null;
  maxRows?: number | null;
}

export const useTabExecution = ({
  connectionId,
  selectedDatabase,
  setTabs,
  flushSave,
}: UseTabExecutionParams) => {
  const lastHistoryErrorLogRef = useRef(0);
  const { requestConfirmation } = useSafeMode();
  const { connection } = useConnection();

  const execute = useCallback(
    async (tabId: string, sql: string, options?: ExecuteOptions) => {
      const sourceDialect = options?.sourceDialect ?? null;
      const runConfig = resolveRunConfig(connection);
      const sandboxedMaxRows = runConfig.sandbox ? runConfig.maxRows : null;
      const maxRows =
        options?.maxRows === undefined ? sandboxedMaxRows : options.maxRows;
      const { timeoutSecs } = runConfig;
      const schema = runConfig.schemaOverride ?? selectedDatabase ?? undefined;

      const confirmed = await requestConfirmation(sql, {
        connectionName: connection.name,
        connectionType: connection.type,
        environment: connection.environment,
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
                  sourceDialect,
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
          maxRows: maxRows ?? null,
          queryId,
          schema,
          sourceDialect: sourceDialect ?? undefined,
          sql,
          timeoutSecs,
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
      } catch (error) {
        const now = Date.now();
        if (
          now - lastHistoryErrorLogRef.current >
          HISTORY_ERROR_LOG_THROTTLE_MS
        ) {
          lastHistoryErrorLogRef.current = now;
          console.warn("Couldn't save query history", error);
        }
      }
    },
    [
      connection,
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
    } catch (error) {
      console.warn("Couldn't cancel query", error);
    }
  }, []);

  return { cancel, execute };
};
