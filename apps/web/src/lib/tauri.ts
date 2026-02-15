import type { DatabaseConnection } from "@/lib/connections";

interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

export const testConnection = async (
  connection: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<TestConnectionResult> => {
  if (!isTauri()) {
    return {
      latencyMs: 0,
      message: "Simulated connection (browser mode)",
      success: true,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");

  const result = await invoke<TestConnectionResult>("test_connection", {
    params: {
      database: connection.database,
      host: connection.host,
      password: connection.password,
      port: connection.port,
      type: connection.type,
      username: connection.username,
    },
  });

  return result;
};

export interface QueryParams {
  connectionId: string;
  sql: string;
  maxRows?: number;
  timeoutSecs?: number;
}

export interface ColumnInfo {
  name: string;
  typeName: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
  isTruncated: boolean;
}

export const connectToDatabase = async (
  connectionId: string,
  connection: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<void> => {
  if (!isTauri()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("connect_to_database", {
    connectionId,
    params: {
      database: connection.database,
      host: connection.host,
      password: connection.password,
      port: connection.port,
      type: connection.type,
      username: connection.username,
    },
  });
};

export const disconnectFromDatabase = async (
  connectionId: string
): Promise<void> => {
  if (!isTauri()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("disconnect_from_database", { connectionId });
};

const MOCK_QUERY_RESULT: QueryResult = {
  columns: [
    { name: "id", typeName: "INT4" },
    { name: "name", typeName: "TEXT" },
    { name: "active", typeName: "BOOL" },
  ],
  executionTimeMs: 42,
  isTruncated: false,
  rowCount: 3,
  rows: [
    [1, "Alice", true],
    [2, "Bob", false],
    [3, "Charlie", true],
  ],
};

export const executeQuery = async (
  params: QueryParams
): Promise<QueryResult> => {
  if (!isTauri()) {
    return MOCK_QUERY_RESULT;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  return invoke<QueryResult>("execute_query", { params });
};
