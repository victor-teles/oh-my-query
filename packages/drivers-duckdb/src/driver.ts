import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import { DuckDBInstance } from "@duckdb/node-api";

import { DuckdbPool, mapDuckdbError } from "./pool";

// DuckDB is process-embedded with no auth/network: `database` is reused as
// the file path; empty or ":memory:" opens an ephemeral in-memory database.
export function resolvePath(params: ConnectionParams): string {
  const path = params.database?.trim();
  return path && path.length > 0 ? path : ":memory:";
}

async function openInstance(
  params: ConnectionParams,
  userAgent: string
): Promise<DuckDBInstance> {
  try {
    return await DuckDBInstance.create(resolvePath(params), {
      custom_user_agent: userAgent,
    });
  } catch (error) {
    throw mapDuckdbError(error);
  }
}

async function openConnection(
  instance: DuckDBInstance
): ReturnType<DuckDBInstance["connect"]> {
  try {
    return await instance.connect();
  } catch (error) {
    throw mapDuckdbError(error);
  }
}

function tryDisconnect(conn: { disconnect(): void }): void {
  try {
    conn.disconnect();
  } catch {
    // already disconnected
  }
}

export class DuckdbDriver implements Driver {
  readonly dbType = "duckdb";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const instance = await openInstance(params, this.dbType);
    const conn = await openConnection(instance);
    try {
      await conn.run("SELECT 1");
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapDuckdbError(error);
    } finally {
      tryDisconnect(conn);
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const instance = await openInstance(params, this.dbType);
    const conn = await openConnection(instance);
    try {
      await conn.run("SELECT 1");
    } catch (error) {
      tryDisconnect(conn);
      throw mapDuckdbError(error);
    }
    tryDisconnect(conn);
    return new DuckdbPool(instance);
  }
}
