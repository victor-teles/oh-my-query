import type { Transition, Variants } from "motion/react";

import { AnimatePresence, motion } from "motion/react";

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

const CONTAINER_VARIANTS: Variants = {
  hidden: {
    transition: { staggerChildren: 0.02 },
  },
  visible: {
    transition: { delayChildren: 0.02, staggerChildren: 0.04 },
  },
};

const LAYOUT_TRANSITION: Transition = {
  damping: 38,
  mass: 0.7,
  stiffness: 450,
  type: "spring",
};

export const DynamicIslandContent = ({
  snapshot,
}: DynamicIslandContentProps) => {
  const handleReconnect =
    snapshot.kind === "connection-error" ? snapshot.onReconnect : undefined;

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
            displayName={snapshot.displayName}
            emoji={snapshot.emoji}
            environment={snapshot.environment}
            serverVersion={snapshot.serverVersion}
            username={snapshot.username}
          />
        )}
        {snapshot.kind === "query-running" && <QueryRunningStatus />}
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
