import { format, isToday, isYesterday } from "date-fns";

import type { DatabaseType } from "@/lib/connections";

export const KNOWN_DIALECTS: DatabaseType[] = [
  "postgresql",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "clickhouse",
  "duckdb",
  "mssql",
];

const DIALECT_SET = new Set<string>(KNOWN_DIALECTS);

export const isKnownDialect = (value: string | null): value is DatabaseType =>
  value !== null && DIALECT_SET.has(value);

export const normalizeSql = (sql: string): string =>
  sql.replaceAll(/\s+/g, " ").trim();

export const getDateLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d, yyyy");
};
