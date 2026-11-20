import type { DestructiveClassifier } from "@conch/core/client";

import { DbError } from "@conch/core/client";
import { classifyDestructive as classifyClickhouse } from "@conch/drivers-clickhouse/safe-mode";
import { classifyDestructive as classifyDuckdb } from "@conch/drivers-duckdb/safe-mode";
import { classifyDestructive as classifyMongo } from "@conch/drivers-mongo/safe-mode";
import { classifyDestructive as classifyMssql } from "@conch/drivers-mssql/safe-mode";
import { classifyDestructive as classifyMysql } from "@conch/drivers-mysql/safe-mode";
import { classifyDestructive as classifyPg } from "@conch/drivers-pg/safe-mode";
import { classifyDestructive as classifyRedis } from "@conch/drivers-redis/safe-mode";
import { classifyDestructive as classifySqlite } from "@conch/drivers-sqlite/safe-mode";

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
