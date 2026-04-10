import { useCallback } from "react";

import type { QueryTab } from "@/lib/query-types";

import { appendHistory, HISTORY_UPDATED_EVENT } from "@/lib/persistence";
import { executeQuery } from "@/lib/tauri";

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
}

export const useTabExecution = ({
  connectionId,
  selectedDatabase,
  setTabs,
}: UseTabExecutionParams) => {
  const execute = useCallback(
    async (tabId: string, sql: string, sourceDialect?: string | null) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                error: null,
                executedSql: null,
                result: null,
                status: "running" as const,
              }
            : t
        )
      );

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
              ? { ...t, error: message, result: null, status: "error" as const }
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
        // Silently ignore history write failures
      }
    },
    [connectionId, selectedDatabase, setTabs]
  );

  return { execute };
};
