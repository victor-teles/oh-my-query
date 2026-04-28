import { create } from "zustand";

import type { SchemaInfo } from "@/lib/tauri";

import { getErrorMessage } from "@/lib/error-message";
import { getSchema, listDatabases } from "@/lib/tauri";

interface SchemaConnectionState {
  identityKey: string | null;
  databases: string[] | null;
  selectedDatabase: string | null;
  schema: SchemaInfo | null;
  schemaDatabase: string | null;
  isLoading: boolean;
  error: string | null;
}

interface SchemaStore {
  byConnection: Record<string, SchemaConnectionState>;
  loadDatabases: (connectionId: string, identityKey: string) => Promise<void>;
  loadSchema: (connectionId: string, databaseName: string) => Promise<void>;
  setSelectedDatabase: (connectionId: string, database: string) => void;
  refresh: (connectionId: string) => Promise<void>;
  clear: (connectionId: string) => void;
}

export const EMPTY_SCHEMA_STATE: SchemaConnectionState = {
  databases: null,
  error: null,
  identityKey: null,
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

  const isStale = (connectionId: string, identityKey: string | null): boolean =>
    (get().byConnection[connectionId]?.identityKey ?? null) !== identityKey;

  const fetchDatabases = async (connectionId: string, identityKey: string) => {
    patch(connectionId, { error: null, identityKey, isLoading: true });
    try {
      const databases = await listDatabases(connectionId);
      if (isStale(connectionId, identityKey)) {
        return;
      }
      const selected =
        databases.find((db) => db === "public") ?? databases[0] ?? null;
      patch(connectionId, (prev) => ({
        databases,
        isLoading: false,
        selectedDatabase: prev.selectedDatabase ?? selected,
      }));
    } catch (error) {
      if (isStale(connectionId, identityKey)) {
        return;
      }
      const message = getErrorMessage(error, "Failed to list databases");
      patch(connectionId, { error: message, isLoading: false });
    }
  };

  const fetchSchema = async (connectionId: string, databaseName: string) => {
    const startIdentityKey =
      get().byConnection[connectionId]?.identityKey ?? null;
    patch(connectionId, { error: null, isLoading: true });
    try {
      const schema = await getSchema(connectionId, databaseName);
      if (isStale(connectionId, startIdentityKey)) {
        return;
      }
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
      if (isStale(connectionId, startIdentityKey)) {
        return;
      }
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

    loadDatabases: async (connectionId, identityKey) => {
      const slice = get().byConnection[connectionId];
      if (slice && slice.identityKey !== identityKey) {
        get().clear(connectionId);
      } else if (slice?.databases || slice?.isLoading) {
        return;
      }
      await fetchDatabases(connectionId, identityKey);
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
