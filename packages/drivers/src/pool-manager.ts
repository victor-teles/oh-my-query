import type { ConnectionParams, Pool } from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";

import { getDriver } from "./registry.ts";

async function safeClose(pool: Pool): Promise<void> {
  try {
    await pool.close();
  } catch {
    // best-effort: pool may already be closing
  }
}

export class ConnectionPoolManager {
  readonly #pools = new Map<string, Pool>();

  async connect(connectionId: string, params: ConnectionParams): Promise<void> {
    const existing = this.#pools.get(connectionId);
    if (existing) {
      await safeClose(existing);
      this.#pools.delete(connectionId);
    }
    const pool = await getDriver(params.type).connect(connectionId, params);
    this.#pools.set(connectionId, pool);
  }

  async disconnect(connectionId: string): Promise<void> {
    const pool = this.#pools.get(connectionId);
    if (!pool) {
      return;
    }
    this.#pools.delete(connectionId);
    await safeClose(pool);
  }

  getPool(connectionId: string): Pool {
    const pool = this.#pools.get(connectionId);
    if (!pool) {
      throw new DbError(
        "NOT_CONNECTED",
        `No active connection for id ${connectionId}`
      );
    }
    return pool;
  }

  has(connectionId: string): boolean {
    return this.#pools.has(connectionId);
  }

  async closeAll(): Promise<void> {
    const pools = [...this.#pools.values()];
    this.#pools.clear();
    await Promise.all(pools.map(safeClose));
  }
}
