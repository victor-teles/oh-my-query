import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";

import { createClient } from "@clickhouse/client";

import { ClickhousePool, mapClickhouseError } from "./pool.ts";

const CONNECT_TIMEOUT_MS = 10_000;

function bracketIfIPv6(host: string): string {
  if (host.startsWith("[") || !host.includes(":")) {
    return host;
  }
  return `[${host}]`;
}

function buildClickhouseUrl(p: ConnectionParams): string {
  return `http://${bracketIfIPv6(p.host)}:${p.port}`;
}

export class ClickhouseDriver implements Driver {
  readonly dbType = "clickhouse";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const client = createClient({
      database: params.database,
      password: params.password,
      request_timeout: CONNECT_TIMEOUT_MS,
      url: buildClickhouseUrl(params),
      username: params.username,
    });
    try {
      const result = await client.ping({ select: true });
      if (!result.success) {
        throw mapClickhouseError(result.error);
      }
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapClickhouseError(error);
    } finally {
      try {
        await client.close();
      } catch {
        // best-effort
      }
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const url = buildClickhouseUrl(params);
    const baseConfig = {
      application: this.dbType,
      password: params.password,
      request_timeout: CONNECT_TIMEOUT_MS,
      url,
      username: params.username,
    };
    const client = createClient({ ...baseConfig, database: params.database });
    try {
      const result = await client.ping({ select: true });
      if (!result.success) {
        throw mapClickhouseError(result.error);
      }
    } catch (error) {
      try {
        await client.close();
      } catch {
        // best-effort
      }
      throw mapClickhouseError(error);
    }
    return new ClickhousePool({
      clientFor: (database) => createClient({ ...baseConfig, database }),
      defaultClient: client,
      defaultDatabase: params.database,
    });
  }
}
