import type {
  ConnectionParams,
  DatabaseConnection,
  Pool,
  TabularResult,
} from "@oh-my-query/core";
import type { ConnectionPoolManager } from "@oh-my-query/drivers";

import { DbError, getConnections } from "@oh-my-query/core";

export const UNSUPPORTED_ENGINE_MESSAGE =
  "Asking questions works with SQL databases for now.";
export const SQL_RUN_UNSUPPORTED_MESSAGE =
  "Running SQL works with SQL databases for now.";
const DEFAULT_SCHEMAS = ["public", "main", "dbo", "default"];

const connectionParams = (
  connection: DatabaseConnection
): ConnectionParams => ({
  authSource: connection.authSource ?? null,
  database: connection.database,
  host: connection.host,
  password: connection.password,
  port: connection.port,
  trustServerCertificate: connection.trustServerCertificate ?? null,
  type: connection.type,
  username: connection.username,
});

export const findConnection = async (
  id: string
): Promise<DatabaseConnection | null> => {
  const connections = await getConnections();
  return connections.find((item) => item.id === id) ?? null;
};

export const ensurePool = async (
  pools: ConnectionPoolManager,
  connection: DatabaseConnection
): Promise<Pool> => {
  if (!pools.has(connection.id)) {
    await pools.connect(connection.id, connectionParams(connection));
  }
  return pools.getPool(connection.id);
};

export const resolveSchemaName = async (
  pool: Pool,
  requested: string | null,
  connection: DatabaseConnection
): Promise<string> => {
  const available = await pool.listDatabases();
  const candidates = [requested, connection.database, ...DEFAULT_SCHEMAS];
  const match = candidates.find(
    (name): name is string => name !== null && available.includes(name)
  );
  return match ?? available[0] ?? connection.database;
};

export const tabular = (
  result: Awaited<ReturnType<Pool["execute"]>>
): TabularResult => {
  if (result.resultType !== "tabular") {
    throw DbError.unsupported(UNSUPPORTED_ENGINE_MESSAGE);
  }
  return result;
};
