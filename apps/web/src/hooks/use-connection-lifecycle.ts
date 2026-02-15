import { useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import {
  connectToDatabase,
  disconnectFromDatabase,
  getServerVersion,
} from "@/lib/tauri";

interface ConnectionLifecycleState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  serverVersion: string | null;
}

export const useConnectionLifecycle = (
  connection: DatabaseConnection
): ConnectionLifecycleState => {
  const [state, setState] = useState<ConnectionLifecycleState>({
    error: null,
    isConnected: false,
    isConnecting: true,
    serverVersion: null,
  });

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
          const message =
            error instanceof Error ? error.message : "Failed to connect";
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

    return () => {
      cancelled = true;
      disconnectFromDatabase(connection.id);
    };
  }, [connection]);

  return state;
};
