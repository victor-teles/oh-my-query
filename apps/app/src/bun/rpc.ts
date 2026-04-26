import type { RpcSchema } from "@oh-my-query/rpc";

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
import { defineElectrobunRPC, Utils } from "electrobun/bun";

import {
  checkForUpdate as doCheckForUpdate,
  installUpdate as doInstallUpdate,
  readChannel as doReadChannel,
  writeChannel as doWriteChannel,
} from "./updater.ts";

const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_TIMEOUT_SECS = 30;

const pools = new ConnectionPoolManager();
const cancellation = new CancellationRegistry();

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

export function createRpc() {
  return defineElectrobunRPC<AppRpcSchema>("bun", {
    handlers: {
      requests: {
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

        getSchema: ({ connectionId, databaseName }) =>
          pools.getPool(connectionId).fetchSchema(databaseName),
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
      },
    },
  });
}
