import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import { DbError } from "@oh-my-query/core";

export class RedisDriver implements Driver {
  readonly dbType = "redis";

  testConnection(_params: ConnectionParams): Promise<TestConnectionResult> {
    return Promise.reject(this.notImplemented());
  }

  connect(_id: string, _params: ConnectionParams): Promise<Pool> {
    return Promise.reject(this.notImplemented());
  }

  private notImplemented(): DbError {
    return new DbError(
      "NOT_IMPLEMENTED",
      `${this.dbType} driver port pending. Track progress in the Electrobun migration.`
    );
  }
}
