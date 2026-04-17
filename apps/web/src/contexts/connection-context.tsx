import type { ReactNode } from "react";

import { createContext, use, useMemo } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";

interface ConnectionContextValue {
  connection: DatabaseConnection;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: string | null;
  serverVersion: string | null;
  reconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export const ConnectionProvider = ({
  connection,
  children,
}: {
  connection: DatabaseConnection;
  children: ReactNode;
}) => {
  const lifecycle = useConnectionLifecycle(connection);
  const value = useMemo(
    () => ({ connection, ...lifecycle }),
    [connection, lifecycle]
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
