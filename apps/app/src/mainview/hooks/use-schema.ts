import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { selectSchemaState, useSchemaStore } from "@/stores/schema-store";

export const useSchema = (
  connectionId: string,
  identityKey: string,
  isConnected: boolean
) => {
  const { databases, selectedDatabase, schema, isLoading, error } =
    useSchemaStore(useShallow(selectSchemaState(connectionId)));

  const loadDatabases = useSchemaStore((s) => s.loadDatabases);
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const setSelectedDatabaseAction = useSchemaStore(
    (s) => s.setSelectedDatabase
  );
  const refreshAction = useSchemaStore((s) => s.refresh);

  useEffect(() => {
    if (isConnected) {
      loadDatabases(connectionId, identityKey);
    }
  }, [isConnected, connectionId, identityKey, loadDatabases]);

  useEffect(() => {
    if (selectedDatabase) {
      loadSchema(connectionId, selectedDatabase);
    }
  }, [connectionId, selectedDatabase, loadSchema]);

  const setSelectedDatabase = useCallback(
    (database: string) => {
      setSelectedDatabaseAction(connectionId, database);
    },
    [connectionId, setSelectedDatabaseAction]
  );

  const refresh = useCallback(() => {
    refreshAction(connectionId);
  }, [connectionId, refreshAction]);

  return {
    databases,
    error,
    isLoading,
    refresh,
    schema,
    selectedDatabase,
    setSelectedDatabase,
  };
};
