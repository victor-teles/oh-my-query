import { AnimatePresence } from "motion/react";

import type { IslandSnapshot } from "@/contexts/island-context";

import {
  AmbientStatus,
  ConnectedIdleStatus,
  ConnectingStatus,
  ConnectionErrorStatus,
  ReconnectingStatus,
  WelcomeStatus,
} from "./island-connection-status";
import {
  QueryErrorStatus,
  QueryRunningStatus,
  QuerySuccessStatus,
} from "./island-query-status";

interface DynamicIslandContentProps {
  snapshot: IslandSnapshot;
}

export const DynamicIslandContent = ({
  snapshot,
}: DynamicIslandContentProps) => {
  const handleReconnect =
    snapshot.kind === "connection-error" ? snapshot.onReconnect : undefined;

  return (
    <AnimatePresence mode="wait">
      {snapshot.kind === "welcome" && <WelcomeStatus key="welcome" />}
      {snapshot.kind === "ambient" && (
        <AmbientStatus key="ambient" connectionName={snapshot.connectionName} />
      )}
      {snapshot.kind === "connecting" && (
        <ConnectingStatus
          key="connecting"
          connectionName={snapshot.connectionName}
        />
      )}
      {snapshot.kind === "reconnecting" && (
        <ReconnectingStatus
          key="reconnecting"
          connectionName={snapshot.connectionName}
        />
      )}
      {snapshot.kind === "connection-error" && handleReconnect && (
        <ConnectionErrorStatus
          key="connection-error"
          error={snapshot.error}
          onReconnect={handleReconnect}
        />
      )}
      {snapshot.kind === "connected-idle" && (
        <ConnectedIdleStatus
          key="connected-idle"
          serverVersion={snapshot.serverVersion}
          username={snapshot.username}
          database={snapshot.database}
        />
      )}
      {snapshot.kind === "query-running" && (
        <QueryRunningStatus key="query-running" />
      )}
      {snapshot.kind === "query-success" && (
        <QuerySuccessStatus
          key="query-success"
          rowCount={snapshot.rowCount}
          executionTimeMs={snapshot.executionTimeMs}
        />
      )}
      {snapshot.kind === "query-error" && (
        <QueryErrorStatus key="query-error" error={snapshot.error} />
      )}
    </AnimatePresence>
  );
};
