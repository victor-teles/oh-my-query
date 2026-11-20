import type { ActionDispatch } from "react";

import { useEffect, useMemo, useRef } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import {
  connectionIdentityKey,
  deleteConnection,
  markConnectionUsed,
  togglePinConnection,
} from "@/lib/connections";
import { getErrorMessage } from "@/lib/error-message";
import {
  connectToDatabase,
  disconnectFromDatabase,
  setActiveConnection,
  testConnection,
} from "@/lib/ipc";

import type { ConnectionsAction } from "./connections-reducer";

export const CONNECTED_CHECK_MS = 900;

export interface ConnectionOperations {
  activate: (connection: DatabaseConnection) => Promise<void>;
  test: (connection: DatabaseConnection) => Promise<void>;
  disconnect: (connection: DatabaseConnection) => Promise<void>;
  remove: (connection: DatabaseConnection) => Promise<void>;
  togglePin: (connection: DatabaseConnection) => Promise<void>;
  saved: (
    connection: DatabaseConnection,
    previous?: DatabaseConnection
  ) => void;
}

interface OperationContext {
  dispatch: ActionDispatch<[ConnectionsAction]>;
  isLive: (id: string) => boolean;
  isActive: (id: string) => boolean;
  schedule: (task: () => void, ms: number) => void;
}

// The session belongs to credentials that no longer exist; a failed close
// leaves nothing to recover.
const dropSession = async (connectionId: string) => {
  await Promise.allSettled([disconnectFromDatabase(connectionId)]);
};

const createOperations = ({
  dispatch,
  isLive,
  isActive,
  schedule,
}: OperationContext): ConnectionOperations => {
  const fail = (id: string, error: unknown, fallback: string) =>
    dispatch({
      activity: { kind: "error", message: getErrorMessage(error, fallback) },
      id,
      type: "activity",
    });

  const closeSession = async (connection: DatabaseConnection) => {
    if (isLive(connection.id)) {
      await disconnectFromDatabase(connection.id);
    }
    if (isActive(connection.id)) {
      await setActiveConnection(null);
    }
  };

  return {
    activate: async (connection) => {
      const { id } = connection;
      dispatch({ activity: { kind: "connecting" }, id, type: "activity" });
      try {
        await connectToDatabase(id, connection);
        await setActiveConnection({
          connectionId: id,
          database: connection.database || null,
        });
        await markConnectionUsed(id);
        dispatch({ id, type: "activated", usedAt: new Date().toISOString() });
        schedule(
          () => dispatch({ id, kind: "connected", type: "activity-settled" }),
          CONNECTED_CHECK_MS
        );
      } catch (error) {
        fail(id, error, "Could not connect.");
      }
    },
    disconnect: async (connection) => {
      try {
        await closeSession(connection);
        dispatch({ id: connection.id, type: "disconnected" });
      } catch (error) {
        fail(connection.id, error, "Could not disconnect.");
      }
    },
    remove: async (connection) => {
      try {
        await closeSession(connection);
        await deleteConnection(connection.id);
        dispatch({ id: connection.id, type: "removed" });
      } catch (error) {
        fail(connection.id, error, "Could not delete this connection.");
      }
    },
    saved: (connection, previous) => {
      const stale =
        previous !== undefined &&
        isLive(connection.id) &&
        connectionIdentityKey(previous) !== connectionIdentityKey(connection);
      if (stale) {
        dropSession(connection.id);
      }
      dispatch({ connection, stale, type: "saved" });
    },
    test: async (connection) => {
      const { id } = connection;
      dispatch({ activity: { kind: "testing" }, id, type: "activity" });
      try {
        const result = await testConnection(connection);
        dispatch({
          activity: result.success
            ? { kind: "tested", latencyMs: result.latencyMs }
            : { kind: "error", message: result.message },
          id,
          type: "activity",
        });
      } catch (error) {
        fail(id, error, "Connection test failed.");
      }
    },
    togglePin: async (connection) => {
      try {
        await togglePinConnection(connection.id);
        dispatch({ id: connection.id, type: "pin-toggled" });
      } catch (error) {
        fail(connection.id, error, "Could not update this connection.");
      }
    },
  };
};

interface UseConnectionOperationsOptions {
  dispatch: ActionDispatch<[ConnectionsAction]>;
  liveIds: readonly string[];
  activeId: string | null;
}

export const useConnectionOperations = ({
  dispatch,
  liveIds,
  activeId,
}: UseConnectionOperationsOptions): ConnectionOperations => {
  const latest = useRef({ activeId, liveIds });
  const timers = useRef(new Set<number>());

  useEffect(() => {
    latest.current = { activeId, liveIds };
  }, [activeId, liveIds]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return useMemo(
    () =>
      createOperations({
        dispatch,
        isActive: (id) => latest.current.activeId === id,
        isLive: (id) => latest.current.liveIds.includes(id),
        schedule: (task, ms) => {
          const timer = window.setTimeout(() => {
            timers.current.delete(timer);
            task();
          }, ms);
          timers.current.add(timer);
        },
      }),
    [dispatch]
  );
};
