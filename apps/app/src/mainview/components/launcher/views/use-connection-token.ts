import { useCallback } from "react";

import type { InputMode } from "@/components/launcher/input-mode";
import type { DatabaseConnection } from "@/lib/connections";

import { commitToken } from "./connection-token";

interface UseConnectionTokenOptions {
  mode: InputMode;
  connections: readonly DatabaseConnection[];
  activate: (connection: DatabaseConnection) => void;
  onQueryChange: (query: string) => void;
}

export const useConnectionToken = ({
  mode,
  connections,
  activate,
  onQueryChange,
}: UseConnectionTokenOptions) => {
  const commit = useCallback(
    (connection: DatabaseConnection) => {
      activate(connection);
      onQueryChange("");
    },
    [activate, onQueryChange]
  );

  const onActivate = useCallback(
    (connection: DatabaseConnection) =>
      mode === "connection" ? commit(connection) : activate(connection),
    [activate, commit, mode]
  );

  const interceptChange = useCallback(
    (nextValue: string): boolean => {
      const connection = commitToken(nextValue, connections);
      if (!connection) {
        return false;
      }
      commit(connection);
      return true;
    },
    [commit, connections]
  );

  return { commit, interceptChange, onActivate };
};
