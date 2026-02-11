export type DatabaseType = "postgresql" | "mysql" | "sqlite";

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
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
};

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

export const deleteConnection = (id: string): void => {
  const connections = getConnections().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};
