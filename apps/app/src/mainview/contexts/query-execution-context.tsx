import type { ReactNode } from "react";

import { createContext, use, useCallback, useState } from "react";

import type { ExecuteResult } from "@/lib/tauri";

type ExecutionStatus = "idle" | "running" | "success" | "error";

interface QueryExecutionState {
  status: ExecutionStatus;
  result: ExecuteResult | null;
  error: string | null;
  startedAt: number | null;
}

interface QueryExecutionContextValue {
  state: QueryExecutionState;
  setExecutionState: (state: QueryExecutionState) => void;
  cancelActive: (() => void) | null;
  setCancelActive: (cancel: (() => void) | null) => void;
}

const IDLE_STATE: QueryExecutionState = {
  error: null,
  result: null,
  startedAt: null,
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
  const [cancelActive, setCancelActiveState] = useState<(() => void) | null>(
    null
  );

  const setExecutionState = useCallback((next: QueryExecutionState) => {
    setState(next);
  }, []);

  const setCancelActive = useCallback((cancel: (() => void) | null) => {
    setCancelActiveState(() => cancel);
  }, []);

  return (
    <QueryExecutionContext
      value={{ cancelActive, setCancelActive, setExecutionState, state }}
    >
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
