import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import { Pool as PgPool } from "pg";

import { mapPgError, PostgresPool } from "./pool.ts";

function buildPgUrl(p: ConnectionParams): string {
  const u = encodeURIComponent(p.username);
  const pw = encodeURIComponent(p.password);
  const db = encodeURIComponent(p.database);
  return `postgres://${u}:${pw}@${p.host}:${p.port}/${db}`;
}

export class PostgresDriver implements Driver {
  readonly dbType = "postgresql";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const pool = new PgPool({
      connectionString: buildPgUrl(params),
      connectionTimeoutMillis: 10_000,
      max: 1,
    });
    try {
      await pool.query("SELECT 1");
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapPgError(error);
    } finally {
      try {
        await pool.end();
      } catch {
        // pool may already be ending
      }
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const pool = new PgPool({
      application_name: this.dbType,
      connectionString: buildPgUrl(params),
      connectionTimeoutMillis: 10_000,
      max: 5,
    });
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      try {
        await pool.end();
      } catch {
        // pool may already be ending
      }
      throw mapPgError(error);
    }
    return new PostgresPool(pool);
  }
}
