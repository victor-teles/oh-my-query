import { useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/tauri";

interface ConnectionLifecycleState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export const useConnectionLifecycle = (
  connection: DatabaseConnection
): ConnectionLifecycleState => {
  const [state, setState] = useState<ConnectionLifecycleState>({
    error: null,
    isConnected: false,
    isConnecting: true,
  });

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      setState({ error: null, isConnected: false, isConnecting: true });

      try {
        await connectToDatabase(connection.id, connection);
        if (!cancelled) {
          setState({ error: null, isConnected: true, isConnecting: false });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Failed to connect";
          setState({ error: message, isConnected: false, isConnecting: false });
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
