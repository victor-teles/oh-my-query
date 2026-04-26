import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ExecuteResult } from "@/lib/tauri";

export type ActiveQueryStatus = "idle" | "running" | "success" | "error";

export interface ActiveQuerySnapshot {
  activeSql: string;
  selectedSql: string | null;
  executedSql: string | null;
  runningSql: string | null;
  result: ExecuteResult | null;
  error: string | null;
  errorCode: string | null;
  status: ActiveQueryStatus;
  tabTitle: string | null;
}

interface ActiveQueryMeta {
  hasSql: boolean;
  hasSelection: boolean;
  hasResult: boolean;
  hasError: boolean;
  isRunning: boolean;
  status: ActiveQueryStatus;
  tabTitle: string | null;
}

interface ActiveQueryContextValue {
  meta: ActiveQueryMeta;
  getSnapshot: () => ActiveQuerySnapshot;
  setActiveSql: (sql: string) => void;
  setSelectedSql: (text: string | null) => void;
  setExecutionSnapshot: (input: {
    executedSql: string | null;
    runningSql: string | null;
    result: ExecuteResult | null;
    error: string | null;
    errorCode: string | null;
    status: ActiveQueryStatus;
  }) => void;
  setTabTitle: (title: string | null) => void;
}

const EMPTY_SNAPSHOT: ActiveQuerySnapshot = {
  activeSql: "",
  error: null,
  errorCode: null,
  executedSql: null,
  result: null,
  runningSql: null,
  selectedSql: null,
  status: "idle",
  tabTitle: null,
};

const EMPTY_META: ActiveQueryMeta = {
  hasError: false,
  hasResult: false,
  hasSelection: false,
  hasSql: false,
  isRunning: false,
  status: "idle",
  tabTitle: null,
};

const ActiveQueryContext = createContext<ActiveQueryContextValue | null>(null);

const deriveMeta = (snapshot: ActiveQuerySnapshot): ActiveQueryMeta => ({
  hasError: Boolean(snapshot.error),
  hasResult: Boolean(snapshot.result),
  hasSelection: Boolean(snapshot.selectedSql?.trim()),
  hasSql: Boolean(snapshot.activeSql.trim()),
  isRunning: snapshot.status === "running",
  status: snapshot.status,
  tabTitle: snapshot.tabTitle,
});

const metaEquals = (a: ActiveQueryMeta, b: ActiveQueryMeta): boolean =>
  a.hasError === b.hasError &&
  a.hasResult === b.hasResult &&
  a.hasSelection === b.hasSelection &&
  a.hasSql === b.hasSql &&
  a.isRunning === b.isRunning &&
  a.status === b.status &&
  a.tabTitle === b.tabTitle;

export const ActiveQueryProvider = ({ children }: { children: ReactNode }) => {
  const snapshotRef = useRef<ActiveQuerySnapshot>(EMPTY_SNAPSHOT);
  const [meta, setMeta] = useState<ActiveQueryMeta>(EMPTY_META);

  const writeSnapshot = useCallback((next: ActiveQuerySnapshot) => {
    snapshotRef.current = next;
    const nextMeta = deriveMeta(next);
    setMeta((prev) => (metaEquals(prev, nextMeta) ? prev : nextMeta));
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const setActiveSql = useCallback(
    (sql: string) => {
      writeSnapshot({ ...snapshotRef.current, activeSql: sql });
    },
    [writeSnapshot]
  );

  const setSelectedSql = useCallback(
    (text: string | null) => {
      const normalized = text?.trim() ? text : null;
      if (snapshotRef.current.selectedSql === normalized) {
        return;
      }
      writeSnapshot({ ...snapshotRef.current, selectedSql: normalized });
    },
    [writeSnapshot]
  );

  const setExecutionSnapshot = useCallback(
    (input: {
      executedSql: string | null;
      runningSql: string | null;
      result: ExecuteResult | null;
      error: string | null;
      errorCode: string | null;
      status: ActiveQueryStatus;
    }) => {
      writeSnapshot({
        ...snapshotRef.current,
        error: input.error,
        errorCode: input.errorCode,
        executedSql: input.executedSql,
        result: input.result,
        runningSql: input.runningSql,
        status: input.status,
      });
    },
    [writeSnapshot]
  );

  const setTabTitle = useCallback(
    (title: string | null) => {
      if (snapshotRef.current.tabTitle === title) {
        return;
      }
      writeSnapshot({ ...snapshotRef.current, tabTitle: title });
    },
    [writeSnapshot]
  );

  const value = useMemo<ActiveQueryContextValue>(
    () => ({
      getSnapshot,
      meta,
      setActiveSql,
      setExecutionSnapshot,
      setSelectedSql,
      setTabTitle,
    }),
    [
      getSnapshot,
      meta,
      setActiveSql,
      setExecutionSnapshot,
      setSelectedSql,
      setTabTitle,
    ]
  );

  return <ActiveQueryContext value={value}>{children}</ActiveQueryContext>;
};

export const useActiveQuery = (): ActiveQueryContextValue => {
  const ctx = use(ActiveQueryContext);
  if (!ctx) {
    throw new Error(
      "useActiveQuery must be used within an ActiveQueryProvider"
    );
  }
  return ctx;
};

export const useOptionalActiveQuery = (): ActiveQueryContextValue | null =>
  use(ActiveQueryContext);
