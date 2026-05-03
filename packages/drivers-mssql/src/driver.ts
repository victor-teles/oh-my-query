import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";
import type { config as MssqlConfig, ConnectionPool } from "mssql";

import { ConnectionPool as MssqlConnectionPool } from "mssql";

import { mapMssqlError, MssqlPool } from "./pool.ts";

const CONNECT_TIMEOUT_MS = 10_000;

function buildConfig(params: ConnectionParams, appName: string): MssqlConfig {
  return {
    connectionTimeout: CONNECT_TIMEOUT_MS,
    database: params.database,
    options: {
      appName,
      encrypt: true,
      trustServerCertificate: params.trustServerCertificate ?? true,
    },
    password: params.password,
    port: params.port,
    requestTimeout: CONNECT_TIMEOUT_MS,
    server: params.host,
    user: params.username,
  };
}

function openPool(params: ConnectionParams, appName: string): ConnectionPool {
  try {
    return new MssqlConnectionPool(buildConfig(params, appName));
  } catch (error) {
    throw mapMssqlError(error);
  }
}

async function safeClose(pool: ConnectionPool): Promise<void> {
  try {
    await pool.close();
  } catch {
    // pool may already be closing
  }
}

export class MssqlDriver implements Driver {
  readonly dbType = "mssql";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const pool = openPool(params, this.dbType);
    try {
      await pool.connect();
      await pool.query("SELECT 1");
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapMssqlError(error);
    } finally {
      await safeClose(pool);
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const pool = openPool(params, this.dbType);
    try {
      await pool.connect();
      await pool.query("SELECT 1");
    } catch (error) {
      await safeClose(pool);
      throw mapMssqlError(error);
    }
    return new MssqlPool(pool, params.database);
  }
}
