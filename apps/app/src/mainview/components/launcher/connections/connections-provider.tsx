import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { getConnections } from "@/lib/connections";
import { getErrorMessage } from "@/lib/error-message";
import { getActiveConnection } from "@/lib/ipc";

import type { ConnectionsState } from "./connections-reducer";
import type { ConnectionOperations } from "./use-connection-operations";

import {
  connectionsReducer,
  initialConnectionsState,
} from "./connections-reducer";
import { useConnectionOperations } from "./use-connection-operations";

interface ConnectionsContextValue extends ConnectionOperations {
  state: ConnectionsState;
  activeConnection: DatabaseConnection | null;
  reload: () => void;
}

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

const readConnections = async () => {
  const [connections, active] = await Promise.all([
    getConnections(),
    getActiveConnection(),
  ]);
  return { activeId: active?.connectionId ?? null, connections };
};

interface ConnectionsProviderProps {
  children: ReactNode;
}

export function ConnectionsProvider({ children }: ConnectionsProviderProps) {
  const [state, dispatch] = useReducer(
    connectionsReducer,
    initialConnectionsState
  );
  const [attempt, setAttempt] = useState(0);
  const operations = useConnectionOperations({
    activeId: state.activeId,
    dispatch,
    liveIds: state.liveIds,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await readConnections();
        if (!cancelled) {
          dispatch({ ...loaded, type: "loaded" });
        }
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, "Connections could not load.");
          dispatch({ message, type: "load-failed" });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    dispatch({ type: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      ...operations,
      activeConnection:
        state.connections.find((c) => c.id === state.activeId) ?? null,
      reload,
      state,
    }),
    [operations, reload, state]
  );

  return <ConnectionsContext value={value}>{children}</ConnectionsContext>;
}

export const useConnections = (): ConnectionsContextValue => {
  const value = use(ConnectionsContext);
  if (!value) {
    throw new Error("useConnections must be used inside ConnectionsProvider");
  }
  return value;
};
