import type { SchemaInfo } from "@oh-my-query/core";
import type { RpcSchema } from "@oh-my-query/rpc";
import type { BrowserWindow } from "electrobun/bun";

import {
  appendHistory,
  CancellationRegistry,
  DbError,
  formatSql as doFormatSql,
  getAllHistory,
  getConfig,
  getConnections,
  getHistory,
  getTabs,
  raceWithCancel,
  resetSecrets,
  saveConfig,
  saveConnections,
  saveTabs,
  transpileSql,
} from "@oh-my-query/core";
import { ConnectionPoolManager, getDriver } from "@oh-my-query/drivers";
import {
  deleteRedisKey as doDeleteRedisKey,
  redisDbInfo as doRedisDbInfo,
  RedisPool,
  scanRedisKeys as doScanRedisKeys,
} from "@oh-my-query/drivers-redis";
import { encodeRpcError } from "@oh-my-query/rpc";
import { defineElectrobunRPC, Utils } from "electrobun/bun";

import {
  checkForUpdate as doCheckForUpdate,
  installUpdate as doInstallUpdate,
  readChannel as doReadChannel,
  writeChannel as doWriteChannel,
} from "./updater.ts";

const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_TIMEOUT_SECS = 30;
const SCHEMA_CACHE_TTL_MS = 60_000;

const pools = new ConnectionPoolManager();
const cancellation = new CancellationRegistry();
const schemaCache = new Map<string, { value: SchemaInfo; expiresAt: number }>();
const schemaCacheKey = (connectionId: string, db: string): string =>
  `${connectionId}::${db}`;
const invalidateSchemaCacheFor = (connectionId: string): void => {
  const prefix = `${connectionId}::`;
  for (const key of schemaCache.keys()) {
    if (key.startsWith(prefix)) {
      schemaCache.delete(key);
    }
  }
};

interface AppRpcSchema {
  bun: RpcSchema;
  // The webview doesn't expose any RPC requests of its own; the empty object
  // literal is required so defineElectrobunRPC's generic structural match
  // against BaseRPCRequestsSchema succeeds and the bun-side handler params
  // are inferred from RpcSchema instead of falling back to `any`.
  // oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types
  webview: { requests: {}; messages: RpcSchema["messages"] };
}

function requireRedis(connectionId: string): RedisPool {
  const pool = pools.getPool(connectionId);
  if (!(pool instanceof RedisPool)) {
    throw new DbError(
      "WRONG_DRIVER",
      "This command is only available for Redis connections"
    );
  }
  return pool;
}

type RequestHandlers = {
  [M in keyof RpcSchema["requests"]]: (
    params: RpcSchema["requests"][M]["params"]
  ) =>
    | RpcSchema["requests"][M]["response"]
    | Promise<RpcSchema["requests"][M]["response"]>;
};

type RawHandler = (params: unknown) => unknown;

const TRACED_METHODS = new Set([
  "connectToDatabase",
  "disconnectFromDatabase",
  "listConnectionDatabases",
  "getSchema",
  "getServerVersion",
  "executeQuery",
]);

const wrapHandlers = (handlers: RequestHandlers): RequestHandlers => {
  const wrapped: Record<string, RawHandler> = {};
  for (const [key, fn] of Object.entries(handlers)) {
    const handler = fn as RawHandler;
    const traced = TRACED_METHODS.has(key);
    wrapped[key] = async (params: unknown) => {
      try {
        const result = await handler(params);
        if (traced) {
          console.log(`[rpc] ok  ${key}`);
        }
        return result;
      } catch (error) {
        const err = error as Error & { code?: string };
        console.log(
          `[rpc] err ${key}: name=${err?.name ?? "-"} code=${err?.code ?? "-"} msg=${err?.message ?? "-"}`
        );
        console.log(err?.stack ?? "(no stack)");
        throw encodeRpcError(error);
      }
    };
  }
  return wrapped as RequestHandlers;
};

export interface CreateRpcOptions {
  getMainWindow: () => BrowserWindow | null;
}

const noWindow: CreateRpcOptions = { getMainWindow: () => null };

export function createRpc(options: CreateRpcOptions = noWindow) {
  const { getMainWindow } = options;
  return defineElectrobunRPC<AppRpcSchema>("bun", {
    handlers: {
      requests: wrapHandlers({
        appendHistory: async ({ entry }) => {
          await appendHistory(entry);
        },

        cancelQuery: ({ queryId }) => cancellation.cancel(queryId),

        checkForUpdate: () => doCheckForUpdate(),

        connectToDatabase: async ({ connectionId, params }) => {
          await pools.connect(connectionId, params);
        },

        deleteRedisKey: ({ connectionId, dbIndex, name }) =>
          doDeleteRedisKey(requireRedis(connectionId), dbIndex, name),

        disconnectFromDatabase: async ({ connectionId }) => {
          invalidateSchemaCacheFor(connectionId);
          await pools.disconnect(connectionId);
        },

        executeQuery: async ({ params }) => {
          const pool = pools.getPool(params.connectionId);
          const maxRows = params.maxRows ?? DEFAULT_MAX_ROWS;
          const timeoutMs = (params.timeoutSecs ?? DEFAULT_TIMEOUT_SECS) * 1000;

          let { sql } = params;
          if (params.sourceDialect && pool.dialect) {
            sql = await transpileSql(
              params.sql,
              params.sourceDialect,
              pool.dialect
            );
          } else if (params.sourceDialect && !pool.dialect) {
            throw new DbError(
              "UNSUPPORTED_TRANSPILE_TARGET",
              "SQL transpilation is not supported for this database type"
            );
          }

          const controller = params.queryId
            ? cancellation.register(params.queryId)
            : new AbortController();
          const start = performance.now();
          try {
            const result = await raceWithCancel(
              (signal) =>
                pool.execute(sql, maxRows, params.schema ?? null, signal),
              { signal: controller.signal, timeoutMs }
            );
            return {
              ...result,
              executionTimeMs: Math.round(performance.now() - start),
            };
          } finally {
            if (params.queryId) {
              cancellation.remove(params.queryId);
            }
          }
        },

        explainQuery: async ({ params }) => {
          const pool = pools.getPool(params.connectionId);
          const timeoutMs = (params.timeoutSecs ?? DEFAULT_TIMEOUT_SECS) * 1000;

          let { sql } = params;
          if (params.sourceDialect && pool.dialect) {
            sql = await transpileSql(
              params.sql,
              params.sourceDialect,
              pool.dialect
            );
          }

          const controller = params.queryId
            ? cancellation.register(params.queryId)
            : new AbortController();
          try {
            return await raceWithCancel(
              (signal) =>
                pool.explain(
                  sql,
                  params.analyze ?? false,
                  params.schema ?? null,
                  signal
                ),
              { signal: controller.signal, timeoutMs }
            );
          } finally {
            if (params.queryId) {
              cancellation.remove(params.queryId);
            }
          }
        },

        formatSql: ({ sql, dialect }) => doFormatSql(sql, dialect),

        getAllHistory: ({ filters }) => getAllHistory(filters ?? {}),

        getConfig: () => getConfig(),

        getConnections: () => getConnections(),

        getHistory: ({ connectionId, limit, offset }) =>
          getHistory(connectionId, limit ?? null, offset ?? null),

        getSchema: async ({ connectionId, databaseName, force }) => {
          const key = schemaCacheKey(connectionId, databaseName);
          if (!force) {
            const hit = schemaCache.get(key);
            if (hit && hit.expiresAt > Date.now()) {
              return hit.value;
            }
          }
          const value = await pools
            .getPool(connectionId)
            .fetchSchema(databaseName);
          schemaCache.set(key, {
            expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS,
            value,
          });
          return value;
        },
        getServerVersion: ({ connectionId }) =>
          pools.getPool(connectionId).fetchVersion(),
        getTabs: ({ connectionId }) => getTabs(connectionId),
        getUpdateChannel: () => doReadChannel(),
        installUpdate: () => doInstallUpdate(),
        listConnectionDatabases: ({ connectionId }) =>
          pools.getPool(connectionId).listDatabases(),
        openExternal: async ({ url }) => {
          await Utils.openExternal(url);
        },
        redisDbInfo: ({ connectionId, dbIndex }) =>
          doRedisDbInfo(requireRedis(connectionId), dbIndex),
        rendererReady: () => {
          console.log("[rpc] renderer ready");
        },
        resetSecrets: async () => {
          await resetSecrets();
        },
        saveConfig: async ({ config }) => {
          await saveConfig(config);
        },

        saveConnections: async ({ connections }) => {
          await saveConnections(connections);
        },
        saveTabs: async ({ connectionId, state }) => {
          await saveTabs(connectionId, state);
        },
        scanRedisKeys: ({ connectionId, dbIndex, pattern, cursor, count }) =>
          doScanRedisKeys(
            requireRedis(connectionId),
            dbIndex,
            pattern ?? null,
            cursor ?? "0",
            count ?? null
          ),
        setUpdateChannel: ({ channel }) => doWriteChannel(channel),

        testConnection: ({ params }) =>
          getDriver(params.type).testConnection(params),

        toggleWindowMaximize: () => {
          const window = getMainWindow();
          if (!window) {
            return false;
          }
          if (window.isMaximized()) {
            window.unmaximize();
            return false;
          }
          window.maximize();
          return true;
        },
      }),
    },
    // Long queries may legitimately run for minutes; cancelQuery is the
    // user-driven recovery path for hung calls, not a transport-level timeout.
    maxRequestTime: Number.POSITIVE_INFINITY,
  });
}
