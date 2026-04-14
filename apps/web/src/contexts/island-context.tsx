import type { ReactNode } from "react";

import { createContext, use, useCallback, useMemo, useState } from "react";

export type IslandSnapshot =
  | { kind: "hidden" }
  | { kind: "ambient"; connectionName: string }
  | { kind: "welcome" }
  | { kind: "connecting"; connectionName: string }
  | { kind: "reconnecting"; connectionName: string }
  | {
      kind: "connection-error";
      error: string;
      onReconnect: () => void;
    }
  | {
      kind: "connected-idle";
      connectionName: string;
      serverVersion: string | null;
      username: string;
      database: string;
    }
  | { kind: "query-running" }
  | {
      kind: "query-success";
      rowCount: number;
      executionTimeMs: number;
    }
  | { kind: "query-error"; error: string };

interface IslandContextValue {
  snapshot: IslandSnapshot;
  setSnapshot: (snapshot: IslandSnapshot) => void;
}

const IslandContext = createContext<IslandContextValue | null>(null);

const HIDDEN: IslandSnapshot = { kind: "hidden" };

export const IslandProvider = ({ children }: { children: ReactNode }) => {
  const [snapshot, setSnapshotState] = useState<IslandSnapshot>(HIDDEN);

  const setSnapshot = useCallback((next: IslandSnapshot) => {
    setSnapshotState(next);
  }, []);

  const value = useMemo(
    () => ({ setSnapshot, snapshot }),
    [snapshot, setSnapshot]
  );

  return <IslandContext value={value}>{children}</IslandContext>;
};

export const useIsland = (): IslandContextValue => {
  const ctx = use(IslandContext);
  if (!ctx) {
    throw new Error("useIsland must be used within an IslandProvider");
  }
  return ctx;
};
