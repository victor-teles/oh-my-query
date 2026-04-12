import { safeGetJson, safeSetJson } from "@/lib/safe-storage";

export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mongodb"
  | "redis"
  | "clickhouse";

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  createdAt: string;
  pinned: boolean;
  lastConnectedAt: string | null;
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  clickhouse: 8123,
  mongodb: 27_017,
  mysql: 3306,
  postgresql: 5432,
  redis: 6379,
  sqlite: 0,
};

export const isSqlDatabase = (type: DatabaseType): boolean =>
  type === "postgresql" ||
  type === "mysql" ||
  type === "sqlite" ||
  type === "clickhouse";

const STORAGE_KEY = "oh-my-query-connections";

const normalizeConnection = (
  raw: Partial<DatabaseConnection> & Pick<DatabaseConnection, "id">
): DatabaseConnection =>
  ({
    ...raw,
    lastConnectedAt: raw.lastConnectedAt ?? null,
    pinned: raw.pinned ?? false,
  }) as DatabaseConnection;

const isConnectionArray = (value: unknown): value is DatabaseConnection[] =>
  Array.isArray(value);

const writeConnections = (connections: DatabaseConnection[]): void => {
  safeSetJson(STORAGE_KEY, connections);
};

export const getConnections = (): DatabaseConnection[] => {
  const parsed = safeGetJson<DatabaseConnection[]>(
    STORAGE_KEY,
    [],
    isConnectionArray
  );
  return parsed.map(normalizeConnection);
};

export const saveConnection = (connection: DatabaseConnection): void => {
  const connections = getConnections();
  connections.push(normalizeConnection(connection));
  writeConnections(connections);
};

export const updateConnection = (updated: DatabaseConnection): void => {
  const connections = getConnections().map((c) =>
    c.id === updated.id ? normalizeConnection(updated) : c
  );
  writeConnections(connections);
};

export const deleteConnection = (id: string): void => {
  const connections = getConnections().filter((c) => c.id !== id);
  writeConnections(connections);
};

export const togglePinConnection = (id: string): void => {
  const connections = getConnections().map((c) =>
    c.id === id ? { ...c, pinned: !c.pinned } : c
  );
  writeConnections(connections);
};

export const markConnectionUsed = (id: string): void => {
  const connections = getConnections().map((c) =>
    c.id === id ? { ...c, lastConnectedAt: new Date().toISOString() } : c
  );
  writeConnections(connections);
};
