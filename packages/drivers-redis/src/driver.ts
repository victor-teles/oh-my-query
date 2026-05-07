import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import Redis from "ioredis";

import { mapRedisError, parseDbIndex, RedisPool } from "./pool";

export { parseDbIndex } from "./pool.ts";

function createClient(params: ConnectionParams, connectionName: string): Redis {
  const db = parseDbIndex(params.database);
  return new Redis({
    connectionName,
    db,
    enableOfflineQueue: false,
    host: params.host,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    password: params.password || undefined,
    port: params.port,
    username: params.username || undefined,
  });
}

async function safeQuit(client: Redis): Promise<void> {
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      // already disconnected
    }
  }
}

function openClient(params: ConnectionParams, connectionName: string): Redis {
  try {
    return createClient(params, connectionName);
  } catch (error) {
    throw mapRedisError(error);
  }
}

export class RedisDriver implements Driver {
  readonly dbType = "redis";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const client = openClient(params, this.dbType);
    try {
      await client.connect();
      await client.ping();
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapRedisError(error);
    } finally {
      await safeQuit(client);
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const client = openClient(params, this.dbType);
    try {
      await client.connect();
      await client.ping();
    } catch (error) {
      await safeQuit(client);
      throw mapRedisError(error);
    }
    return new RedisPool(client, parseDbIndex(params.database));
  }
}
