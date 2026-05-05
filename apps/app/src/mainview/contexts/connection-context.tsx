import type { ReactNode } from "react";

import { createContext, use, useCallback, useMemo, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { RunConfig } from "@/lib/query-types";

import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";
import { resolveRunConfig, updateConnection } from "@/lib/connections";

interface ConnectionContextValue {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: string | null;
  serverVersion: string | null;
  reconnect: () => void;
  runConfig: RunConfig;
  setRunConfig: (partial: Partial<RunConfig>) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export const ConnectionProvider = ({
  connection,
  children,
}: {
  connection: DatabaseConnection;
  children: ReactNode;
}) => {
  const [storedConnectionId, setStoredConnectionId] = useState(connection.id);
  const [runConfig, setRunConfigState] = useState<RunConfig>(() =>
    resolveRunConfig(connection)
  );

  if (storedConnectionId !== connection.id) {
    setStoredConnectionId(connection.id);
    setRunConfigState(resolveRunConfig(connection));
  }

  const liveConnection = useMemo<DatabaseConnection>(
    () => ({ ...connection, runConfig }),
    [connection, runConfig]
  );

  const lifecycle = useConnectionLifecycle(liveConnection);

  const persistRunConfig = useCallback(
    async (next: RunConfig): Promise<void> => {
      try {
        await updateConnection({ ...connection, runConfig: next });
      } catch (error) {
        console.warn("Couldn't persist runConfig", error);
      }
    },
    [connection]
  );

  const setRunConfig = useCallback(
    (partial: Partial<RunConfig>) => {
      const next = {
        ...resolveRunConfig({ ...connection, runConfig }),
        ...partial,
      };
      setRunConfigState(next);
      persistRunConfig(next);
    },
    [connection, runConfig, persistRunConfig]
  );

  const value = useMemo(
    () => ({
      connection: liveConnection,
      runConfig,
      setRunConfig,
      ...lifecycle,
    }),
    [liveConnection, runConfig, setRunConfig, lifecycle]
  );

  return <ConnectionContext value={value}>{children}</ConnectionContext>;
};

export const useConnection = (): ConnectionContextValue => {
  const ctx = use(ConnectionContext);
  if (!ctx) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return ctx;
};
