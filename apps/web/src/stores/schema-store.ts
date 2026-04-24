import { create } from "zustand";

import type { SchemaInfo } from "@/lib/tauri";

import { getErrorMessage } from "@/lib/error-message";
import { getSchema, listDatabases } from "@/lib/tauri";

interface SchemaConnectionState {
  databases: string[] | null;
  selectedDatabase: string | null;
  schema: SchemaInfo | null;
  schemaDatabase: string | null;
  isLoading: boolean;
  error: string | null;
}

interface SchemaStore {
  byConnection: Record<string, SchemaConnectionState>;
  loadDatabases: (connectionId: string) => Promise<void>;
  loadSchema: (connectionId: string, databaseName: string) => Promise<void>;
  setSelectedDatabase: (connectionId: string, database: string) => void;
  refresh: (connectionId: string) => Promise<void>;
  clear: (connectionId: string) => void;
}

export const EMPTY_SCHEMA_STATE: SchemaConnectionState = {
  databases: null,
  error: null,
  isLoading: false,
  schema: null,
  schemaDatabase: null,
  selectedDatabase: null,
};

export const useSchemaStore = create<SchemaStore>((set, get) => {
  const patch = (
    connectionId: string,
    updater:
      | Partial<SchemaConnectionState>
      | ((prev: SchemaConnectionState) => Partial<SchemaConnectionState>)
  ) => {
    set((state) => {
      const prev = state.byConnection[connectionId] ?? EMPTY_SCHEMA_STATE;
      const next = typeof updater === "function" ? updater(prev) : updater;
      return {
        byConnection: {
          ...state.byConnection,
          [connectionId]: { ...prev, ...next },
        },
      };
    });
  };

  const fetchDatabases = async (connectionId: string) => {
    patch(connectionId, { error: null, isLoading: true });
    try {
      const databases = await listDatabases(connectionId);
      const selected =
        databases.find((db) => db === "public") ?? databases[0] ?? null;
      patch(connectionId, (prev) => ({
        databases,
        isLoading: false,
        selectedDatabase: prev.selectedDatabase ?? selected,
      }));
    } catch (error) {
      const message = getErrorMessage(error, "Failed to list databases");
      patch(connectionId, { error: message, isLoading: false });
    }
  };

  const fetchSchema = async (connectionId: string, databaseName: string) => {
    patch(connectionId, { error: null, isLoading: true });
    try {
      const schema = await getSchema(connectionId, databaseName);
      patch(connectionId, (prev) => {
        if (prev.selectedDatabase !== databaseName) {
          return { isLoading: false };
        }
        return {
          error: null,
          isLoading: false,
          schema,
          schemaDatabase: databaseName,
        };
      });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to load schema");
      patch(connectionId, (prev) => {
        if (prev.selectedDatabase !== databaseName) {
          return { isLoading: false };
        }
        return {
          error: message,
          isLoading: false,
          schema: null,
          schemaDatabase: null,
        };
      });
    }
  };

  return {
    byConnection: {},

    clear: (connectionId) => {
      set((state) => {
        if (!state.byConnection[connectionId]) {
          return state;
        }
        const { [connectionId]: _removed, ...rest } = state.byConnection;
        return { byConnection: rest };
      });
    },

    loadDatabases: async (connectionId) => {
      const slice = get().byConnection[connectionId];
      if (slice?.databases || slice?.isLoading) {
        return;
      }
      await fetchDatabases(connectionId);
    },

    loadSchema: async (connectionId, databaseName) => {
      const slice = get().byConnection[connectionId];
      if (
        slice?.schema &&
        slice.schemaDatabase === databaseName &&
        !slice.error
      ) {
        return;
      }
      await fetchSchema(connectionId, databaseName);
    },

    refresh: async (connectionId) => {
      const slice = get().byConnection[connectionId];
      const database = slice?.selectedDatabase;
      if (!database) {
        return;
      }
      await fetchSchema(connectionId, database);
    },

    setSelectedDatabase: (connectionId, database) => {
      patch(connectionId, {
        schema: null,
        schemaDatabase: null,
        selectedDatabase: database,
      });
    },
  };
});

export const selectSchemaState =
  (connectionId: string): ((store: SchemaStore) => SchemaConnectionState) =>
  (store) =>
    store.byConnection[connectionId] ?? EMPTY_SCHEMA_STATE;
