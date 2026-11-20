import type { SchemaInfo } from "@oh-my-query/core";
import type { ConnectionPoolManager } from "@oh-my-query/drivers";

const SCHEMA_CACHE_TTL_MS = 60_000;

export interface SchemaCache {
  get(
    connectionId: string,
    database: string,
    force?: boolean
  ): Promise<SchemaInfo>;
  invalidate(connectionId: string): void;
}

const keyOf = (connectionId: string, database: string): string =>
  `${connectionId}::${database}`;

export const createSchemaCache = (
  pools: ConnectionPoolManager
): SchemaCache => {
  const entries = new Map<string, { value: SchemaInfo; expiresAt: number }>();

  return {
    async get(connectionId, database, force = false) {
      const key = keyOf(connectionId, database);
      const hit = entries.get(key);
      if (!force && hit && hit.expiresAt > Date.now()) {
        return hit.value;
      }
      const value = await pools.getPool(connectionId).fetchSchema(database);
      entries.set(key, { expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS, value });
      return value;
    },
    invalidate(connectionId) {
      const prefix = `${connectionId}::`;
      for (const key of entries.keys()) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      }
    },
  };
};
