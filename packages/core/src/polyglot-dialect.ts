import { Dialect } from "@polyglot-sql/sdk";

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

export const toPolyglotDialect = (name: string): Dialect => {
  const dialect = DIALECT_MAP[name.toLowerCase()];
  if (!dialect) {
    throw new DbError("UNSUPPORTED_DIALECT", `Unsupported dialect '${name}'`);
  }
  return dialect;
};
