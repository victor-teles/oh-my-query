import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import { createPool } from "mysql2/promise";

import { mapMysqlError, MysqlPool } from "./pool.ts";

const CONNECT_TIMEOUT_MS = 10_000;

function buildPoolOptions(params: ConnectionParams) {
  return {
    bigNumberStrings: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    database: params.database,
    dateStrings: false,
    decimalNumbers: false,
    host: params.host,
    multipleStatements: false,
    password: params.password,
    port: params.port,
    supportBigNumbers: true,
    user: params.username,
    waitForConnections: true,
  } as const;
}

export class MysqlDriver implements Driver {
  readonly dbType = "mysql";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const pool = createPool({
      ...buildPoolOptions(params),
      connectionLimit: 1,
    });
    try {
      await pool.query("SELECT 1");
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapMysqlError(error);
    } finally {
      try {
        await pool.end();
      } catch {
        // pool may already be ending
      }
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const pool = createPool({
      ...buildPoolOptions(params),
      connectAttributes: { program_name: this.dbType },
      connectionLimit: 5,
    });
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      try {
        await pool.end();
      } catch {
        // pool may already be ending
      }
      throw mapMysqlError(error);
    }
    return new MysqlPool(pool, params.database);
  }
}
