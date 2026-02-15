import type { ReactNode } from "react";

import { createContext, use, useCallback, useState } from "react";

import type { QueryResult } from "@/lib/tauri";

type ExecutionStatus = "idle" | "running" | "success" | "error";

interface QueryExecutionState {
  status: ExecutionStatus;
  result: QueryResult | null;
  error: string | null;
}

interface QueryExecutionContextValue {
  state: QueryExecutionState;
  setExecutionState: (state: QueryExecutionState) => void;
}

const IDLE_STATE: QueryExecutionState = {
  error: null,
  result: null,
  status: "idle",
};

const QueryExecutionContext = createContext<QueryExecutionContextValue | null>(
  null
);

export const QueryExecutionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [state, setState] = useState<QueryExecutionState>(IDLE_STATE);

  const setExecutionState = useCallback((next: QueryExecutionState) => {
    setState(next);
  }, []);

  return (
    <QueryExecutionContext value={{ setExecutionState, state }}>
      {children}
    </QueryExecutionContext>
  );
};

export const useQueryExecution = (): QueryExecutionContextValue => {
  const ctx = use(QueryExecutionContext);
  if (!ctx) {
    throw new Error(
      "useQueryExecution must be used within a QueryExecutionProvider"
    );
  }
  return ctx;
};
