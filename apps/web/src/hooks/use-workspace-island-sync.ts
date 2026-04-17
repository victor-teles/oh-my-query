import { useEffect, useRef, useState } from "react";

import type { IslandSnapshot } from "@/contexts/island-context";
import type { DatabaseConnection } from "@/lib/connections";

import { useConnection } from "@/contexts/connection-context";
import { useIsland } from "@/contexts/island-context";
import { useQueryExecution } from "@/contexts/query-execution-context";

const DISMISS_DELAY_SUCCESS = 3000;
const DISMISS_DELAY_ERROR = 4000;

export const useWorkspaceIslandSync = () => {
  const {
    connection,
    isConnected,
    isConnecting,
    isReconnecting,
    error: connectionError,
    serverVersion,
    reconnect,
  } = useConnection();
  const { setSnapshot } = useIsland();
  const { state: execState } = useQueryExecution();
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (execState.status === "running") {
      setDismissed(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [execState.status]);

  useEffect(() => {
    const snapshot = resolveSnapshot({
      connection,
      connectionError,
      dismissed,
      execState,
      isConnected,
      isConnecting,
      isReconnecting,
      onReconnect: reconnect,
      serverVersion,
    });
    setSnapshot(snapshot);

    if (snapshot.kind === "query-success") {
      timerRef.current = setTimeout(
        () => setDismissed(true),
        DISMISS_DELAY_SUCCESS
      );
    } else if (snapshot.kind === "query-error") {
      timerRef.current = setTimeout(
        () => setDismissed(true),
        DISMISS_DELAY_ERROR
      );
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    connection,
    connectionError,
    dismissed,
    execState,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnect,
    serverVersion,
    setSnapshot,
  ]);
};

interface ResolveInput {
  connection: DatabaseConnection;
  connectionError: string | null;
  dismissed: boolean;
  execState: ReturnType<typeof useQueryExecution>["state"];
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  onReconnect: () => void;
  serverVersion: string | null;
}

const resolveSnapshot = ({
  connection,
  connectionError,
  dismissed,
  execState,
  isConnected,
  isConnecting,
  isReconnecting,
  onReconnect,
  serverVersion,
}: ResolveInput): IslandSnapshot => {
  if (isReconnecting) {
    return { connectionName: connection.name, kind: "reconnecting" };
  }
  if (connectionError) {
    return { error: connectionError, kind: "connection-error", onReconnect };
  }
  if (isConnecting) {
    return { connectionName: connection.name, kind: "connecting" };
  }
  if (!isConnected) {
    return {
      connectionName: connection.name,
      database: connection.database,
      kind: "connected-idle",
      serverVersion,
      username: connection.username,
    };
  }
  if (execState.status === "running") {
    return { kind: "query-running" };
  }
  if (execState.status === "error" && execState.error && !dismissed) {
    return { error: execState.error, kind: "query-error" };
  }
  if (execState.status === "success" && execState.result && !dismissed) {
    const rowCount =
      execState.result.resultType === "tabular"
        ? execState.result.rowCount
        : execState.result.count;
    return {
      executionTimeMs: execState.result.executionTimeMs,
      kind: "query-success",
      rowCount,
    };
  }
  return {
    connectionName: connection.name,
    database: connection.database,
    kind: "connected-idle",
    serverVersion,
    username: connection.username,
  };
};
