import type { DestructiveClassifier } from "@oh-my-query/core/client";

import { DbError } from "@oh-my-query/core/client";
import { classifyDestructive as classifyClickhouse } from "@oh-my-query/drivers-clickhouse/safe-mode";
import { classifyDestructive as classifyDuckdb } from "@oh-my-query/drivers-duckdb/safe-mode";
import { classifyDestructive as classifyMongo } from "@oh-my-query/drivers-mongo/safe-mode";
import { classifyDestructive as classifyMssql } from "@oh-my-query/drivers-mssql/safe-mode";
import { classifyDestructive as classifyMysql } from "@oh-my-query/drivers-mysql/safe-mode";
import { classifyDestructive as classifyPg } from "@oh-my-query/drivers-pg/safe-mode";
import { classifyDestructive as classifyRedis } from "@oh-my-query/drivers-redis/safe-mode";
import { classifyDestructive as classifySqlite } from "@oh-my-query/drivers-sqlite/safe-mode";

const CLASSIFIERS: Record<string, DestructiveClassifier> = {
  clickhouse: classifyClickhouse,
  duckdb: classifyDuckdb,
  mongodb: classifyMongo,
  mssql: classifyMssql,
  mysql: classifyMysql,
  postgresql: classifyPg,
  redis: classifyRedis,
  sqlite: classifySqlite,
};

export const getDestructiveClassifier = (
  dbType: string
): DestructiveClassifier => {
  if (!Object.hasOwn(CLASSIFIERS, dbType)) {
    throw new DbError(
      "UNSUPPORTED_DB_TYPE",
      `Unknown database type: ${dbType}`
    );
  }

  return CLASSIFIERS[dbType] as DestructiveClassifier;
};
