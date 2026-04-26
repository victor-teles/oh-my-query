import { useCallback } from "react";
import { toast } from "sonner";

import type { QueryTab } from "@/lib/query-types";

import { cancelQuery, explainQuery } from "@/lib/tauri";

const isCancellationError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code } = error as { code?: unknown };
  return code === "QUERY_CANCELLED";
};

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
  return { code: null, message: "EXPLAIN failed" };
};

interface UseTabExplainParams {
  connectionId: string;
  selectedDatabase: string | null;
  setTabs: React.Dispatch<React.SetStateAction<QueryTab[]>>;
}

export const useTabExplain = ({
  connectionId,
  selectedDatabase,
  setTabs,
}: UseTabExplainParams) => {
  const explain = useCallback(
    async (
      tabId: string,
      sql: string,
      sourceDialect: string | null,
      analyze: boolean
    ) => {
      const queryId = crypto.randomUUID();
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                explainError: null,
                explainStatus: "running",
                runningExplainId: queryId,
              }
            : t
        )
      );

      try {
        const result = await explainQuery({
          analyze,
          connectionId,
          queryId,
          schema: selectedDatabase ?? undefined,
          sourceDialect: sourceDialect ?? undefined,
          sql,
        });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  explainError: null,
                  explainResult: result,
                  explainStatus: "success",
                  runningExplainId: null,
                }
              : t
          )
        );
      } catch (error) {
        const cancelled = isCancellationError(error);
        const extracted = extractError(error);
        const message = cancelled ? "EXPLAIN cancelled" : extracted.message;
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  explainError: cancelled ? null : message,
                  explainStatus: cancelled ? "idle" : "error",
                  runningExplainId: null,
                }
              : t
          )
        );
        if (cancelled) {
          toast.info("EXPLAIN cancelled");
        }
      }
    },
    [connectionId, selectedDatabase, setTabs]
  );

  const cancel = useCallback(async (queryId: string) => {
    try {
      await cancelQuery(queryId);
    } catch {
      toast.error("Couldn't cancel EXPLAIN");
    }
  }, []);

  return { cancel, explain };
};
