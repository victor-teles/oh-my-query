import { useEffect, useRef, useState } from "react";

import type { IslandSnapshot } from "@/contexts/island-context";
import type { DatabaseConnection } from "@/lib/connections";

import { useConnection } from "@/contexts/connection-context";
import { useIsland } from "@/contexts/island-context";
import { useQueryExecution } from "@/contexts/query-execution-context";

const DISMISS_DELAY_SUCCESS = 3000;
const DISMISS_DELAY_ERROR = 4000;
const DISMISS_DELAY_CANCELLED = 1500;

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
  const { state: execState, cancelActive } = useQueryExecution();
  const [dismissed, setDismissed] = useState(false);
  const [showCancelledUntil, setShowCancelledUntil] = useState(0);
  const prevStatusRef = useRef(execState.status);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (execState.status === "running") {
      setDismissed(false);
      setShowCancelledUntil(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (cancelledTimerRef.current) {
        clearTimeout(cancelledTimerRef.current);
        cancelledTimerRef.current = null;
      }
    }
    if (prevStatusRef.current === "running" && execState.status === "idle") {
      const until = Date.now() + DISMISS_DELAY_CANCELLED;
      setShowCancelledUntil(until);
      cancelledTimerRef.current = setTimeout(
        () => setShowCancelledUntil(0),
        DISMISS_DELAY_CANCELLED
      );
    }
    prevStatusRef.current = execState.status;
  }, [execState.status]);

  useEffect(() => {
    const showCancelled = Date.now() < showCancelledUntil;
    const snapshot = resolveSnapshot({
      cancelActive,
      connection,
      connectionError,
      dismissed,
      execState,
      isConnected,
      isConnecting,
      isReconnecting,
      onReconnect: reconnect,
      serverVersion,
      showCancelled,
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
    cancelActive,
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
    showCancelledUntil,
  ]);

  useEffect(
    () => () => {
      if (cancelledTimerRef.current) {
        clearTimeout(cancelledTimerRef.current);
      }
    },
    []
  );
};

interface ResolveInput {
  cancelActive: (() => void) | null;
  connection: DatabaseConnection;
  connectionError: string | null;
  dismissed: boolean;
  execState: ReturnType<typeof useQueryExecution>["state"];
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  onReconnect: () => void;
  serverVersion: string | null;
  showCancelled: boolean;
}

const resolveSnapshot = ({
  cancelActive,
  connection,
  connectionError,
  dismissed,
  execState,
  isConnected,
  isConnecting,
  isReconnecting,
  onReconnect,
  serverVersion,
  showCancelled,
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
      color: connection.color,
      connectionName: connection.name,
      database: connection.database,
      emoji: connection.emoji,
      environment: connection.environment,
      kind: "connected-idle",
      serverVersion,
      username: connection.username,
    };
  }
  if (execState.status === "running") {
    return {
      kind: "query-running",
      onCancel: cancelActive ?? undefined,
      startedAt: execState.startedAt ?? Date.now(),
    };
  }
  if (showCancelled) {
    return { kind: "query-cancelled" };
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
    color: connection.color,
    connectionName: connection.name,
    database: connection.database,
    emoji: connection.emoji,
    environment: connection.environment,
    kind: "connected-idle",
    serverVersion,
    username: connection.username,
  };
};
