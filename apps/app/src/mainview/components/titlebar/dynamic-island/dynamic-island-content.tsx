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
  switch (snapshot.kind) {
    case "welcome": {
      return <WelcomeStatus />;
    }
    case "ambient": {
      return <AmbientStatus connectionName={snapshot.connectionName} />;
    }
    case "connecting": {
      return <ConnectingStatus connectionName={snapshot.connectionName} />;
    }
    case "reconnecting": {
      return <ReconnectingStatus connectionName={snapshot.connectionName} />;
    }
    case "connection-error": {
      const handleReconnect = snapshot.onReconnect;
      return (
        <ConnectionErrorStatus
          error={snapshot.error}
          onReconnect={handleReconnect}
        />
      );
    }
    case "connected-idle": {
      return (
        <ConnectedIdleStatus
          color={snapshot.color}
          connectionName={snapshot.connectionName}
          database={snapshot.database}
          emoji={snapshot.emoji}
          environment={snapshot.environment}
          serverVersion={snapshot.serverVersion}
          username={snapshot.username}
        />
      );
    }
    case "query-running": {
      const handleCancelAll = snapshot.onCancelAll;
      return (
        <QueryRunningStatus
          headlineTabId={snapshot.headlineTabId}
          onCancelAll={handleCancelAll}
          runners={snapshot.runners}
        />
      );
    }
    case "query-streaming": {
      const handleCancel = snapshot.onCancel;
      return (
        <QueryStreamingStatus
          onCancel={handleCancel}
          tokensReceived={snapshot.tokensReceived}
        />
      );
    }
    case "query-planning": {
      const handleCancel = snapshot.onCancel;
      return <QueryPlanningStatus onCancel={handleCancel} />;
    }
    case "query-cancelled": {
      return <QueryCancelledStatus />;
    }
    case "query-success": {
      return (
        <QuerySuccessStatus
          executionTimeMs={snapshot.executionTimeMs}
          rowCount={snapshot.rowCount}
        />
      );
    }
    case "query-error": {
      return <QueryErrorStatus error={snapshot.error} />;
    }
    default: {
      return null;
    }
  }
};
