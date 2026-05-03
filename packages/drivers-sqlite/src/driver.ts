import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";
import type { Database as BunDatabase } from "bun:sqlite";

import { Database } from "bun:sqlite";

import { mapSqliteError, SqlitePool } from "./pool.ts";

export function resolvePath(params: ConnectionParams): string {
  const path = params.database?.trim();
  return path && path.length > 0 ? path : ":memory:";
}

function openDatabase(params: ConnectionParams): BunDatabase {
  try {
    return new Database(resolvePath(params), { create: true, readwrite: true });
  } catch (error) {
    throw mapSqliteError(error);
  }
}

function safeClose(db: BunDatabase): void {
  try {
    db.close();
  } catch {
    // already closed
  }
}

function probe(db: BunDatabase): void {
  try {
    db.query("SELECT 1").get();
  } catch (error) {
    throw mapSqliteError(error);
  }
}

export class SqliteDriver implements Driver {
  readonly dbType = "sqlite";

  testConnection(params: ConnectionParams): Promise<TestConnectionResult> {
    const start = performance.now();
    const db = openDatabase(params);
    try {
      probe(db);
      return Promise.resolve({
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      });
    } catch (error) {
      return Promise.reject(mapSqliteError(error));
    } finally {
      safeClose(db);
    }
  }

  connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const db = openDatabase(params);
    try {
      probe(db);
    } catch (error) {
      safeClose(db);
      return Promise.reject(mapSqliteError(error));
    }
    return Promise.resolve(new SqlitePool(db, this.dbType));
  }
}
