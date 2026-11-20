import type { ConnectionParams, Driver } from "@conch/core";

import { DbError } from "@conch/core";
import { ClickhouseDriver } from "@conch/drivers-clickhouse";
import { DuckdbDriver } from "@conch/drivers-duckdb";
import { MongoDriver } from "@conch/drivers-mongo";
import { MssqlDriver } from "@conch/drivers-mssql";
import { MysqlDriver } from "@conch/drivers-mysql";
import { PostgresDriver } from "@conch/drivers-pg";
import { RedisDriver } from "@conch/drivers-redis";
import { SqliteDriver } from "@conch/drivers-sqlite";

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
