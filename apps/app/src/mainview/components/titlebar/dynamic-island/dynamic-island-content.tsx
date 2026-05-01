import { AnimatePresence, motion } from "motion/react";

import type { IslandSnapshot } from "@/contexts/island-context";

import { QueryPlanningStatus, QueryStreamingStatus } from "./island-ai-status";
import {
  AmbientStatus,
  ConnectedIdleStatus,
  ConnectingStatus,
  ConnectionErrorStatus,
  ReconnectingStatus,
  WelcomeStatus,
} from "./island-connection-status";
import { CONTAINER_VARIANTS, LAYOUT_TRANSITION } from "./island-motion";
import {
  QueryCancelledStatus,
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
  const handleCancel =
    snapshot.kind === "query-running" ||
    snapshot.kind === "query-streaming" ||
    snapshot.kind === "query-planning"
      ? snapshot.onCancel
      : undefined;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        animate="visible"
        className="flex items-center gap-1.5"
        exit="hidden"
        initial="hidden"
        key={snapshot.kind}
        layout
        transition={LAYOUT_TRANSITION}
        variants={CONTAINER_VARIANTS}
      >
        {snapshot.kind === "welcome" && <WelcomeStatus />}
        {snapshot.kind === "ambient" && (
          <AmbientStatus connectionName={snapshot.connectionName} />
        )}
        {snapshot.kind === "connecting" && (
          <ConnectingStatus connectionName={snapshot.connectionName} />
        )}
        {snapshot.kind === "reconnecting" && (
          <ReconnectingStatus connectionName={snapshot.connectionName} />
        )}
        {snapshot.kind === "connection-error" && handleReconnect && (
          <ConnectionErrorStatus
            error={snapshot.error}
            onReconnect={handleReconnect}
          />
        )}
        {snapshot.kind === "connected-idle" && (
          <ConnectedIdleStatus
            color={snapshot.color}
            connectionName={snapshot.connectionName}
            database={snapshot.database}
            emoji={snapshot.emoji}
            environment={snapshot.environment}
            serverVersion={snapshot.serverVersion}
            username={snapshot.username}
          />
        )}
        {snapshot.kind === "query-running" && (
          <QueryRunningStatus
            onCancel={handleCancel}
            startedAt={snapshot.startedAt}
          />
        )}
        {snapshot.kind === "query-streaming" && (
          <QueryStreamingStatus
            onCancel={handleCancel}
            tokensReceived={snapshot.tokensReceived}
          />
        )}
        {snapshot.kind === "query-planning" && (
          <QueryPlanningStatus onCancel={handleCancel} />
        )}
        {snapshot.kind === "query-cancelled" && <QueryCancelledStatus />}
        {snapshot.kind === "query-success" && (
          <QuerySuccessStatus
            executionTimeMs={snapshot.executionTimeMs}
            rowCount={snapshot.rowCount}
          />
        )}
        {snapshot.kind === "query-error" && (
          <QueryErrorStatus error={snapshot.error} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
