import type { DatabaseConnection as IpcDatabaseConnection } from "@/lib/ipc";

import {
  getConnections as ipcGetConnections,
  saveConnections as ipcSaveConnections,
} from "@/lib/ipc";

export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mongodb"
  | "redis"
  | "clickhouse"
  | "duckdb"
  | "mssql";

export type ConnectionEnvironment = "dev" | "staging" | "prod";

export type ConnectionColor =
  | "honey"
  | "denim"
  | "moss"
  | "plum"
  | "clay"
  | "stone";

export interface DatabaseConnection extends Omit<
  IpcDatabaseConnection,
  "type" | "color" | "environment"
> {
  type: DatabaseType;
  color?: ConnectionColor;
  environment?: ConnectionEnvironment;
  piiRedaction?: boolean;
  customPiiPatterns?: string[];
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  clickhouse: 8123,
  duckdb: 0,
  mongodb: 27_017,
  mssql: 1433,
  mysql: 3306,
  postgresql: 5432,
  redis: 6379,
  sqlite: 0,
};

export const isSqlDatabase = (type: DatabaseType): boolean =>
  type === "postgresql" ||
  type === "mysql" ||
  type === "sqlite" ||
  type === "clickhouse" ||
  type === "duckdb" ||
  type === "mssql";

const normalizeConnection = (
  raw: Partial<DatabaseConnection> & Pick<DatabaseConnection, "id">
): DatabaseConnection =>
  ({
    ...raw,
    lastConnectedAt: raw.lastConnectedAt ?? null,
    pinned: raw.pinned ?? false,
  }) as DatabaseConnection;

export const getConnections = async (): Promise<DatabaseConnection[]> => {
  const connections = await ipcGetConnections();
  return connections.map((c) =>
    normalizeConnection(c as unknown as DatabaseConnection)
  );
};

const writeConnections = async (
  connections: DatabaseConnection[]
): Promise<void> => {
  await ipcSaveConnections(connections as unknown as IpcDatabaseConnection[]);
};

export const saveConnection = async (
  connection: DatabaseConnection
): Promise<void> => {
  const connections = await getConnections();
  connections.push(normalizeConnection(connection));
  await writeConnections(connections);
};

export const updateConnection = async (
  updated: DatabaseConnection
): Promise<void> => {
  const current = await getConnections();
  const connections = current.map((c) =>
    c.id === updated.id ? normalizeConnection(updated) : c
  );
  await writeConnections(connections);
};

export const deleteConnection = async (id: string): Promise<void> => {
  const current = await getConnections();
  const connections = current.filter((c) => c.id !== id);
  await writeConnections(connections);
};

export const togglePinConnection = async (id: string): Promise<void> => {
  const current = await getConnections();
  const connections = current.map((c) =>
    c.id === id ? { ...c, pinned: !c.pinned } : c
  );
  await writeConnections(connections);
};

export const markConnectionUsed = async (id: string): Promise<void> => {
  const current = await getConnections();
  const connections = current.map((c) =>
    c.id === id ? { ...c, lastConnectedAt: new Date().toISOString() } : c
  );
  await writeConnections(connections);
};

export const isPiiRedactionEnabled = (c: DatabaseConnection): boolean => {
  if (c.piiRedaction !== undefined) {
    return c.piiRedaction;
  }
  return c.environment === "prod";
};

export const connectionIdentityKey = (c: DatabaseConnection): string =>
  JSON.stringify([
    c.id,
    c.type,
    c.host,
    c.port,
    c.database,
    c.username,
    c.password,
    c.authSource ?? null,
    c.trustServerCertificate ?? null,
  ]);
