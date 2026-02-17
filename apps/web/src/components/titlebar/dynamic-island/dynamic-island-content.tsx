import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useQueryExecution } from "@/contexts/query-execution-context";

import {
  ConnectedIdleStatus,
  ConnectingStatus,
  ConnectionErrorStatus,
  ReconnectingStatus,
} from "./island-connection-status";
import {
  QueryErrorStatus,
  QueryRunningStatus,
  QuerySuccessStatus,
} from "./island-query-status";

type IslandState =
  | "connecting"
  | "reconnecting"
  | "connection-error"
  | "query-running"
  | "query-error"
  | "query-success"
  | "idle";

interface DynamicIslandContentProps {
  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  connectionName: string;
  serverVersion: string | null;
  username: string;
  database: string;
  onReconnect: () => void;
}

const DISMISS_DELAY_SUCCESS = 3000;
const DISMISS_DELAY_ERROR = 4000;

export const DynamicIslandContent = ({
  isConnecting,
  isConnected,
  isReconnecting,
  connectionError,
  connectionName,
  serverVersion,
  username,
  database,
  onReconnect,
}: DynamicIslandContentProps) => {
  const { state: execState } = useQueryExecution();
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedState = resolveIslandState(
    isConnecting,
    isConnected,
    isReconnecting,
    connectionError,
    execState.status,
    dismissed
  );

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
    if (resolvedState === "query-success") {
      timerRef.current = setTimeout(
        () => setDismissed(true),
        DISMISS_DELAY_SUCCESS
      );
    } else if (resolvedState === "query-error") {
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
  }, [resolvedState]);

  return (
    <AnimatePresence mode="wait">
      {resolvedState === "connection-error" && connectionError && (
        <ConnectionErrorStatus
          key="conn-error"
          error={connectionError}
          onReconnect={onReconnect}
        />
      )}
      {resolvedState === "reconnecting" && (
        <ReconnectingStatus
          key="reconnecting"
          connectionName={connectionName}
        />
      )}
      {resolvedState === "connecting" && (
        <ConnectingStatus key="connecting" connectionName={connectionName} />
      )}
      {resolvedState === "query-running" && (
        <QueryRunningStatus key="query-running" />
      )}
      {resolvedState === "query-error" && execState.error && (
        <QueryErrorStatus key="query-error" error={execState.error} />
      )}
      {resolvedState === "query-success" && execState.result && (
        <QuerySuccessStatus
          key="query-success"
          rowCount={
            execState.result.resultType === "tabular"
              ? execState.result.rowCount
              : execState.result.count
          }
          executionTimeMs={execState.result.executionTimeMs}
        />
      )}
      {resolvedState === "idle" && (
        <ConnectedIdleStatus
          key="idle"
          serverVersion={serverVersion}
          username={username}
          database={database}
        />
      )}
    </AnimatePresence>
  );
};

const resolveIslandState = (
  isConnecting: boolean,
  isConnected: boolean,
  isReconnecting: boolean,
  connectionError: string | null,
  queryStatus: string,
  dismissed: boolean
): IslandState => {
  if (isReconnecting) {
    return "reconnecting";
  }
  if (connectionError) {
    return "connection-error";
  }
  if (isConnecting) {
    return "connecting";
  }
  if (!isConnected) {
    return "idle";
  }
  if (queryStatus === "running") {
    return "query-running";
  }
  if (queryStatus === "error" && !dismissed) {
    return "query-error";
  }
  if (queryStatus === "success" && !dismissed) {
    return "query-success";
  }
  return "idle";
};
