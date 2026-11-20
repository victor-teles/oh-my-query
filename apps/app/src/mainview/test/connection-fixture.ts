import type { DatabaseConnection } from "@/lib/connections";

export const makeConnection = (
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection => ({
  createdAt: "2026-11-01T00:00:00.000Z",
  database: "analytics",
  host: "localhost",
  id: "conn-analytics",
  lastConnectedAt: null,
  name: "analytics",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
  ...overrides,
});
