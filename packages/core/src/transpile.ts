import { Dialect, format, transpile } from "@polyglot-sql/sdk";

import type { DialectType } from "./types.ts";

import { DbError } from "./error.ts";

const DIALECT_MAP: Record<string, Dialect> = {
  bigquery: Dialect.BigQuery,
  clickhouse: Dialect.ClickHouse,
  duckdb: Dialect.DuckDB,
  mssql: Dialect.TSQL,
  mysql: Dialect.MySQL,
  oracle: Dialect.Oracle,
  postgres: Dialect.PostgreSQL,
  postgresql: Dialect.PostgreSQL,
  redshift: Dialect.Redshift,
  snowflake: Dialect.Snowflake,
  sqlite: Dialect.SQLite,
  tsql: Dialect.TSQL,
};

function toDialect(name: string): Dialect {
  const dialect = DIALECT_MAP[name.toLowerCase()];
  if (!dialect) {
    throw new DbError("UNSUPPORTED_DIALECT", `Unsupported dialect '${name}'`);
  }
  return dialect;
}

export function transpileSql(
  sql: string,
  sourceDialect: string,
  target: DialectType
): string {
  const source = toDialect(sourceDialect);
  const dest = toDialect(target);
  if (source === dest) {
    return sql;
  }
  const result = transpile(sql, source, dest);
  if (!result.success || !result.sql) {
    throw new DbError(
      "TRANSPILE_ERROR",
      `SQL transpilation failed: ${result.error ?? "unknown error"}`
    );
  }
  return result.sql.join(";\n");
}

export function formatSql(sql: string, dialect: string): string {
  const target = toDialect(dialect);
  const result = format(sql, target);
  if (!result.success || !result.sql) {
    throw new DbError(
      "FORMAT_ERROR",
      `SQL formatting failed: ${result.error ?? "unknown error"}`
    );
  }
  return result.sql.join(";\n\n");
}
