import { useCallback, useEffect, useState } from "react";

import type { SchemaInfo } from "@/lib/tauri";

import { getSchema, listDatabases } from "@/lib/tauri";

interface SchemaState {
  databases: string[] | null;
  selectedDatabase: string | null;
  schema: SchemaInfo | null;
  isLoading: boolean;
  error: string | null;
}

export const useSchema = (connectionId: string, isConnected: boolean) => {
  const [state, setState] = useState<SchemaState>({
    databases: null,
    error: null,
    isLoading: false,
    schema: null,
    selectedDatabase: null,
  });

  const fetchDatabases = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null, isLoading: true }));

    try {
      const databases = await listDatabases(connectionId);
      const selected =
        databases.find((db) => db === "public") ?? databases[0] ?? null;

      setState((prev) => ({
        ...prev,
        databases,
        isLoading: false,
        selectedDatabase: selected,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list databases";
      setState((prev) => ({ ...prev, error: message, isLoading: false }));
    }
  }, [connectionId]);

  const fetchSchema = useCallback(
    async (databaseName: string) => {
      setState((prev) => ({ ...prev, error: null, isLoading: true }));

      try {
        const schema = await getSchema(connectionId, databaseName);
        setState((prev) => ({
          ...prev,
          error: null,
          isLoading: false,
          schema,
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load schema";
        setState((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
          schema: null,
        }));
      }
    },
    [connectionId]
  );

  const setSelectedDatabase = useCallback((database: string) => {
    setState((prev) => ({ ...prev, schema: null, selectedDatabase: database }));
  }, []);

  const refresh = useCallback(() => {
    if (state.selectedDatabase) {
      fetchSchema(state.selectedDatabase);
    }
  }, [state.selectedDatabase, fetchSchema]);

  useEffect(() => {
    if (isConnected) {
      fetchDatabases();
    }
  }, [isConnected, fetchDatabases]);

  useEffect(() => {
    if (state.selectedDatabase) {
      fetchSchema(state.selectedDatabase);
    }
  }, [state.selectedDatabase, fetchSchema]);

  return {
    databases: state.databases,
    error: state.error,
    isLoading: state.isLoading,
    refresh,
    schema: state.schema,
    selectedDatabase: state.selectedDatabase,
    setSelectedDatabase,
  };
};
