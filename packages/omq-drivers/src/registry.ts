import type { ConnectionParams, Driver } from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";
import { ClickhouseDriver } from "@oh-my-query/drivers-clickhouse";
import { DuckdbDriver } from "@oh-my-query/drivers-duckdb";
import { MongoDriver } from "@oh-my-query/drivers-mongo";
import { MssqlDriver } from "@oh-my-query/drivers-mssql";
import { MysqlDriver } from "@oh-my-query/drivers-mysql";
import { PostgresDriver } from "@oh-my-query/drivers-pg";
import { RedisDriver } from "@oh-my-query/drivers-redis";
import { SqliteDriver } from "@oh-my-query/drivers-sqlite";

const DRIVERS: Record<string, () => Driver> = {
  clickhouse: () => new ClickhouseDriver(),
  duckdb: () => new DuckdbDriver(),
  mongodb: () => new MongoDriver(),
  mssql: () => new MssqlDriver(),
  mysql: () => new MysqlDriver(),
  postgresql: () => new PostgresDriver(),
  redis: () => new RedisDriver(),
  sqlite: () => new SqliteDriver(),
};

export function getDriver(dbType: string): Driver {
  const factory = DRIVERS[dbType];
  if (!factory) {
    throw new DbError(
      "UNSUPPORTED_DB_TYPE",
      `Unknown database type: ${dbType}`
    );
  }
  return factory();
}

export function testConnection(params: ConnectionParams) {
  return getDriver(params.type).testConnection(params);
}
