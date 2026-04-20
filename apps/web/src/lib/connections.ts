import { isTauri } from "@/lib/tauri";

export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mongodb"
  | "redis"
  | "clickhouse";

export type ConnectionEnvironment = "dev" | "staging" | "prod";

export type ConnectionColor =
  | "honey"
  | "denim"
  | "moss"
  | "plum"
  | "clay"
  | "stone";

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  authSource?: string;
  createdAt: string;
  pinned: boolean;
  lastConnectedAt: string | null;
  color?: ConnectionColor;
  emoji?: string;
  nickname?: string;
  environment?: ConnectionEnvironment;
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

const readLocalStorage = (): DatabaseConnection[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as DatabaseConnection[];
  return parsed.map(normalizeConnection);
};

const writeLocalStorage = (connections: DatabaseConnection[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};

const migration = { done: false };

export const getConnections = async (): Promise<DatabaseConnection[]> => {
  if (!isTauri()) {
    return readLocalStorage();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const connections = await invoke<DatabaseConnection[]>("get_connections");

  if (connections.length === 0 && !migration.done) {
    migration.done = true;
    const local = readLocalStorage();
    if (local.length > 0) {
      await invoke("save_connections", { connections: local });
      return local;
    }
  }

  migration.done = true;
  return connections.map(normalizeConnection);
};

const writeConnections = async (
  connections: DatabaseConnection[]
): Promise<void> => {
  if (!isTauri()) {
    writeLocalStorage(connections);
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_connections", { connections });
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
