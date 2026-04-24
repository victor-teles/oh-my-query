import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { markConnectionUsed } from "@/lib/connections";
import { getErrorMessage } from "@/lib/error-message";
import {
  connectToDatabase,
  disconnectFromDatabase,
  getServerVersion,
} from "@/lib/tauri";

interface ConnectionLifecycleState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: string | null;
  serverVersion: string | null;
  reconnect: () => void;
}

const connectionIdentityKey = (c: DatabaseConnection): string =>
  `${c.id}|${c.type}|${c.host}|${c.port}|${c.database}|${c.username}|${c.password}|${c.authSource ?? ""}|${c.trustServerCertificate ?? ""}`;

export const useConnectionLifecycle = (
  connection: DatabaseConnection
): ConnectionLifecycleState => {
  const [reconnectCount, setReconnectCount] = useState(0);
  const [state, setState] = useState<
    Omit<ConnectionLifecycleState, "reconnect" | "isReconnecting">
  >({
    error: null,
    isConnected: false,
    isConnecting: true,
    serverVersion: null,
  });

  const reconnect = useCallback(() => {
    setReconnectCount((c) => c + 1);
  }, []);

  const identityKey = connectionIdentityKey(connection);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      setState({
        error: null,
        isConnected: false,
        isConnecting: true,
        serverVersion: null,
      });

      try {
        await connectToDatabase(connection.id, connection);
        try {
          await markConnectionUsed(connection.id);
        } catch {
          // non-critical — timestamp update is best-effort
        }
        if (cancelled) {
          return;
        }

        let version: string | null = null;
        try {
          version = await getServerVersion(connection.id);
        } catch {
          // version fetch is non-critical
        }

        if (!cancelled) {
          setState({
            error: null,
            isConnected: true,
            isConnecting: false,
            serverVersion: version,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, "Failed to connect");
          setState({
            error: message,
            isConnected: false,
            isConnecting: false,
            serverVersion: null,
          });
        }
      }
    };

    connect();

    const teardown = async () => {
      try {
        await disconnectFromDatabase(connection.id);
      } catch {
        // teardown is best-effort — ignore errors
      }
    };

    return () => {
      cancelled = true;
      teardown();
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: identityKey is the stable identity for `connection`; reconnect is intentional when any connection field changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey, reconnectCount]);

  return {
    ...state,
    isReconnecting: reconnectCount > 0 && state.isConnecting,
    reconnect,
  };
};
