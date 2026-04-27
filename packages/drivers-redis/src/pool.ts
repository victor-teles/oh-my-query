import type {
  ExecuteResult,
  ExplainResult,
  Pool,
  RedisDbInfo,
  RedisScanPage,
  SchemaInfo,
} from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";

export class RedisPool implements Pool {
  readonly dialect = null;
  readonly supportsExplain = false;
  readonly kind = "redis" as const;

  fetchVersion(): Promise<string> {
    return Promise.reject(this.notImplemented());
  }

  listDatabases(): Promise<string[]> {
    return Promise.reject(this.notImplemented());
  }

  fetchSchema(_db: string): Promise<SchemaInfo> {
    return Promise.reject(this.notImplemented());
  }

  execute(): Promise<ExecuteResult> {
    return Promise.reject(this.notImplemented());
  }

  explain(): Promise<ExplainResult> {
    return Promise.reject(this.notImplemented());
  }

  async close(): Promise<void> {
    // The real driver will tear down its ioredis client here.
    await Promise.resolve(this.kind);
  }

  private notImplemented(): DbError {
    return new DbError(
      "NOT_IMPLEMENTED",
      `${this.kind} pool port pending. Track progress in the Electrobun migration.`
    );
  }
}

export function isRedisPool(pool: Pool): pool is RedisPool {
  return pool instanceof RedisPool;
}

export function redisDbInfo(
  pool: RedisPool,
  _dbIndex: number
): Promise<RedisDbInfo> {
  return Promise.reject(notImplementedFor(pool));
}

export function scanRedisKeys(
  pool: RedisPool,
  _dbIndex: number,
  _pattern: string | null,
  _cursor: string,
  _count: number | null
): Promise<RedisScanPage> {
  return Promise.reject(notImplementedFor(pool));
}

export function deleteRedisKey(
  pool: RedisPool,
  _dbIndex: number,
  _name: string
): Promise<number> {
  return Promise.reject(notImplementedFor(pool));
}

function notImplementedFor(pool: RedisPool): DbError {
  return new DbError(
    "NOT_IMPLEMENTED",
    `${pool.kind} command port pending. Track progress in the Electrobun migration.`
  );
}
