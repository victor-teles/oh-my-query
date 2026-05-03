import path from "node:path";

import type { DatabaseConnection, HistoryEntry } from "./persistence.ts";

export function appConfigDir(home: string): string {
  return path.join(home, ".config/oh-my-query");
}

export function makeHistoryEntry(
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  return {
    connectionId: "c1",
    database: "main",
    dialect: "postgresql",
    error: null,
    executionTimeMs: 12,
    sql: "SELECT 1",
    success: true,
    timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
    ...overrides,
  };
}

export function makeConnection(
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection {
  return {
    createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
    database: "postgres",
    host: "localhost",
    id: "c1",
    lastConnectedAt: null,
    name: "Local Postgres",
    password: "supersecret",
    pinned: false,
    port: 5432,
    type: "postgresql",
    username: "postgres",
    ...overrides,
  };
}
