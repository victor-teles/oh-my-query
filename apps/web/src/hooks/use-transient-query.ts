import { useCallback, useState } from "react";

import type { ExecuteResult } from "@/lib/tauri";

import { executeQuery } from "@/lib/tauri";

type TransientStatus = "idle" | "running" | "success" | "error";

interface TransientState {
  status: TransientStatus;
  result: ExecuteResult | null;
  error: string | null;
}

interface UseTransientQueryParams {
  connectionId: string;
  schema?: string;
}

interface UseTransientQueryReturn extends TransientState {
  run: (sql: string) => Promise<void>;
  reset: () => void;
}

const INITIAL: TransientState = {
  error: null,
  result: null,
  status: "idle",
};

export const useTransientQuery = ({
  connectionId,
  schema,
}: UseTransientQueryParams): UseTransientQueryReturn => {
  const [state, setState] = useState<TransientState>(INITIAL);

  const run = useCallback(
    async (sql: string) => {
      setState({ error: null, result: null, status: "running" });
      try {
        const result = await executeQuery({
          connectionId,
          queryId: crypto.randomUUID(),
          schema,
          sql,
        });
        setState({ error: null, result, status: "success" });
      } catch (error) {
        setState({
          error: error instanceof Error ? error.message : String(error),
          result: null,
          status: "error",
        });
      }
    },
    [connectionId, schema]
  );

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  return { ...state, reset, run };
};
