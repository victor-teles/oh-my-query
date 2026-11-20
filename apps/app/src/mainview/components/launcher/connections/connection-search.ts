import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

import { fuzzyMatch } from "@/lib/fuzzy-match";

const TYPE_LABELS: Record<DatabaseType, string> = {
  clickhouse: "ClickHouse",
  duckdb: "DuckDB",
  mongodb: "MongoDB",
  mssql: "SQL Server",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  redis: "Redis",
  sqlite: "SQLite",
};

export const databaseTypeLabel = (type: DatabaseType): string =>
  TYPE_LABELS[type];

const FILE_BASED = new Set<DatabaseType>(["sqlite", "duckdb"]);

const fileName = (path: string): string => path.split("/").at(-1) ?? path;

export const connectionSubtitle = (connection: DatabaseConnection): string => {
  const type = databaseTypeLabel(connection.type);
  if (FILE_BASED.has(connection.type)) {
    return `${type} · ${fileName(connection.database)}`;
  }
  const target = connection.database
    ? `${connection.host}/${connection.database}`
    : connection.host;
  return `${type} · ${target}`;
};

const timestamp = (value: string | null | undefined): number =>
  value ? Date.parse(value) || 0 : 0;

export const compareConnections = (
  a: DatabaseConnection,
  b: DatabaseConnection
): number => {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  const recency = timestamp(b.lastConnectedAt) - timestamp(a.lastConnectedAt);
  if (recency !== 0) {
    return recency;
  }
  return a.name.localeCompare(b.name);
};

export const sortConnections = (
  connections: readonly DatabaseConnection[]
): DatabaseConnection[] => connections.toSorted(compareConnections);

const searchTerms = (connection: DatabaseConnection): string[] => [
  connection.name,
  connection.database,
  connection.host,
  databaseTypeLabel(connection.type),
  connection.environment ?? "",
];

const bestScore = (
  connection: DatabaseConnection,
  query: string
): number | null => {
  let best: number | null = null;
  for (const term of searchTerms(connection)) {
    const match = term ? fuzzyMatch(term, query) : null;
    if (match && (best === null || match.score > best)) {
      best = match.score;
    }
  }
  return best;
};

export const filterConnections = (
  connections: readonly DatabaseConnection[],
  query: string
): DatabaseConnection[] => {
  const sorted = sortConnections(connections);
  const trimmed = query.trim();
  if (!trimmed) {
    return sorted;
  }
  return sorted
    .map((connection) => ({
      connection,
      score: bestScore(connection, trimmed),
    }))
    .filter(
      (entry): entry is { connection: DatabaseConnection; score: number } =>
        entry.score !== null
    )
    .toSorted((a, b) => b.score - a.score)
    .map((entry) => entry.connection);
};
