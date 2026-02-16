export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mongodb"
  | "redis";

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
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  mongodb: 27_017,
  mysql: 3306,
  postgresql: 5432,
  redis: 6379,
  sqlite: 0,
};

export const isSqlDatabase = (type: DatabaseType): boolean =>
  type === "postgresql" || type === "mysql" || type === "sqlite";

const STORAGE_KEY = "oh-my-query-connections";

export const getConnections = (): DatabaseConnection[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  return JSON.parse(raw) as DatabaseConnection[];
};

export const saveConnection = (connection: DatabaseConnection): void => {
  const connections = getConnections();
  connections.push(connection);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};

export const updateConnection = (updated: DatabaseConnection): void => {
  const connections = getConnections().map((c) =>
    c.id === updated.id ? updated : c
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};

export const deleteConnection = (id: string): void => {
  const connections = getConnections().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};
