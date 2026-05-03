import type { DatabaseType } from "@/lib/connections";

export const EMOJI_CATALOG = [
  "🐘",
  "🐬",
  "🦆",
  "🍃",
  "🗄️",
  "📊",
  "📈",
  "💾",
  "⚡️",
  "🔑",
  "🔒",
  "🧪",
  "🌐",
  "⚙️",
  "📦",
  "🗃",
] as const;

export const EMOJI_BY_TYPE: Record<DatabaseType, string> = {
  clickhouse: "📊",
  duckdb: "🦆",
  mongodb: "🍃",
  mssql: "🗄️",
  mysql: "🐬",
  postgresql: "🐘",
  redis: "⚡️",
  sqlite: "💾",
};

export const DATABASE_OPTIONS: { value: DatabaseType; label: string }[] = [
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
  { label: "Microsoft SQL Server", value: "mssql" },
  { label: "ClickHouse", value: "clickhouse" },
  { label: "DuckDB", value: "duckdb" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Redis", value: "redis" },
];

export const NEEDS_HOST = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "clickhouse",
  "mongodb",
  "redis",
  "mssql",
]);

export const NEEDS_USERNAME = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "clickhouse",
  "mongodb",
  "mssql",
]);
