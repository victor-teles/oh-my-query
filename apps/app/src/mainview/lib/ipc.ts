import type {
  AppConfig,
  ColumnDetail,
  ColumnInfo,
  ConnectionParams,
  DatabaseConnection,
  DocumentResult,
  ExecuteResult,
  ExplainParams,
  ExplainResult,
  ForeignKeyItem,
  HistoryEntry,
  HistoryFilters,
  IndexItem,
  PersistedTab,
  PlanCost,
  PlanNode,
  PlanRows,
  PlanTiming,
  QueryParams,
  QueryResult,
  RedisDbInfo,
  RedisKey,
  RedisKeyKind,
  RedisScanPage,
  RedisSizeUnit,
  SchemaInfo,
  SchemaItem,
  TableItem,
  TabState,
  TabularResult,
  TestConnectionResult,
  ViewItem,
} from "@oh-my-query/core/client";
import type {
  AvailableUpdate,
  RpcSchema,
  UpdateChannel,
} from "@oh-my-query/rpc";

import {
  ENGINE_SUPPORTS_ANALYZE,
  ENGINE_SUPPORTS_EXPLAIN,
} from "@oh-my-query/core/client";
import { Electroview } from "electrobun/view";

export type {
  AppConfig,
  AvailableUpdate,
  ColumnDetail,
  ColumnInfo,
  ConnectionParams,
  DatabaseConnection,
  DocumentResult,
  ExecuteResult,
  ExplainParams,
  ExplainResult,
  ForeignKeyItem,
  HistoryEntry,
  HistoryFilters,
  IndexItem,
  PersistedTab,
  PlanCost,
  PlanNode,
  PlanRows,
  PlanTiming,
  QueryParams,
  QueryResult,
  RedisDbInfo,
  RedisKey,
  RedisKeyKind,
  RedisScanPage,
  RedisSizeUnit,
  RpcSchema,
  SchemaInfo,
  SchemaItem,
  TableItem,
  TabState,
  TabularResult,
  TestConnectionResult,
  UpdateChannel,
  ViewItem,
};
export { ENGINE_SUPPORTS_ANALYZE, ENGINE_SUPPORTS_EXPLAIN };

const IOS_UA_RE = /iPhone|iPad|iPod/i;
const MAC_UA_RE = /Mac/i;

export const isMacOS = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  return MAC_UA_RE.test(ua) && !IOS_UA_RE.test(ua);
};

interface AppRpcSchema {
  bun: RpcSchema;
  webview: { requests: Record<string, never>; messages: RpcSchema["messages"] };
}

interface MessageHandlers {
  menuNavigate?: (payload: { route: string }) => void;
  updateProgress?: (payload: {
    percent: number;
    downloaded: number;
    total: number;
  }) => void;
}

const messageHandlers: MessageHandlers = {};

const definedRpc = Electroview.defineRPC<AppRpcSchema>({
  handlers: {
    messages: {
      menuNavigate: (payload) => messageHandlers.menuNavigate?.(payload),
      updateProgress: (payload) => messageHandlers.updateProgress?.(payload),
    },
    requests: {},
  },
});

const electroview = new Electroview({ rpc: definedRpc });

if (!electroview.rpc) {
  throw new Error("Electroview RPC client failed to initialize");
}

// Mirrors the encoder in apps/app/src/bun/rpc.ts: Electrobun's RPC layer only
// forwards `error.message`, so DbError.code is encoded into the message there
// and decoded back here so cancellation/timeout/etc. branches keep working.
const ENCODED_ERROR_PREFIX = "__omq_err__";

const decodeRpcError = (err: unknown): unknown => {
  if (!(err instanceof Error)) {
    return err;
  }
  if (!err.message.startsWith(ENCODED_ERROR_PREFIX)) {
    return err;
  }
  try {
    const parsed = JSON.parse(
      err.message.slice(ENCODED_ERROR_PREFIX.length)
    ) as { code?: unknown; message?: unknown };
    if (typeof parsed.code !== "string" || typeof parsed.message !== "string") {
      return err;
    }
    const decoded = new Error(parsed.message);
    (decoded as Error & { code: string }).code = parsed.code;
    decoded.name = "DbError";
    return decoded;
  } catch {
    return err;
  }
};

const baseRequest = electroview.rpc.request as unknown as Record<
  string,
  // oxlint-disable-next-line typescript/no-explicit-any
  (params: unknown) => Promise<any>
>;

const wrappedRequest = new Proxy(baseRequest, {
  get(target, prop, receiver) {
    const original = Reflect.get(target, prop, receiver);
    if (typeof original !== "function") {
      return original;
    }
    return async (params: unknown) => {
      try {
        return await original(params);
      } catch (error) {
        throw decodeRpcError(error);
      }
    };
  },
});

const rpc = {
  ...electroview.rpc,
  request: wrappedRequest as unknown as typeof electroview.rpc.request,
};

export function onMenuNavigate(handler: (route: string) => void): () => void {
  messageHandlers.menuNavigate = (payload) => handler(payload.route);
  return () => {
    messageHandlers.menuNavigate = undefined;
  };
}

export function onUpdateProgress(
  handler: (progress: {
    percent: number;
    downloaded: number;
    total: number;
  }) => void
): () => void {
  messageHandlers.updateProgress = handler;
  return () => {
    messageHandlers.updateProgress = undefined;
  };
}

function paramsFor(
  conn: Omit<
    DatabaseConnection,
    "id" | "name" | "createdAt" | "pinned" | "lastConnectedAt"
  >
): ConnectionParams {
  return {
    authSource: conn.authSource ?? null,
    database: conn.database,
    host: conn.host,
    password: conn.password,
    port: conn.port,
    trustServerCertificate: conn.trustServerCertificate ?? null,
    type: conn.type,
    username: conn.username,
  };
}

export const testConnection = (
  conn: Omit<
    DatabaseConnection,
    "id" | "name" | "createdAt" | "pinned" | "lastConnectedAt"
  >
): Promise<TestConnectionResult> =>
  rpc.request.testConnection({ params: paramsFor(conn) });

export const connectToDatabase = (
  connectionId: string,
  conn: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<void> =>
  rpc.request.connectToDatabase({ connectionId, params: paramsFor(conn) });

export const disconnectFromDatabase = (connectionId: string): Promise<void> =>
  rpc.request.disconnectFromDatabase({ connectionId });

export const getServerVersion = (connectionId: string): Promise<string> =>
  rpc.request.getServerVersion({ connectionId });

export const listDatabases = (connectionId: string): Promise<string[]> =>
  rpc.request.listConnectionDatabases({ connectionId });

export const getSchema = (
  connectionId: string,
  databaseName: string
): Promise<SchemaInfo> => rpc.request.getSchema({ connectionId, databaseName });

export const executeQuery = (params: QueryParams): Promise<ExecuteResult> =>
  rpc.request.executeQuery({ params });

export const explainQuery = (params: ExplainParams): Promise<ExplainResult> =>
  rpc.request.explainQuery({ params });

export const cancelQuery = (queryId: string): Promise<boolean> =>
  rpc.request.cancelQuery({ queryId });

export const formatSql = (sql: string, dialect: string): Promise<string> =>
  rpc.request.formatSql({ dialect, sql });

export const redisDbInfo = (
  connectionId: string,
  dbIndex: number
): Promise<RedisDbInfo> => rpc.request.redisDbInfo({ connectionId, dbIndex });

export const scanRedisKeys = (params: {
  connectionId: string;
  dbIndex: number;
  pattern?: string | null;
  cursor?: string | null;
  count?: number | null;
}): Promise<RedisScanPage> => rpc.request.scanRedisKeys(params);

export const deleteRedisKey = (params: {
  connectionId: string;
  dbIndex: number;
  name: string;
}): Promise<number> => rpc.request.deleteRedisKey(params);

export const getTabs = (connectionId: string): Promise<TabState | null> =>
  rpc.request.getTabs({ connectionId });

export const saveTabs = (
  connectionId: string,
  state: TabState
): Promise<void> => rpc.request.saveTabs({ connectionId, state });

export const appendHistory = (entry: HistoryEntry): Promise<void> =>
  rpc.request.appendHistory({ entry });

export const getHistory = (
  connectionId: string,
  limit?: number | null,
  offset?: number | null
): Promise<HistoryEntry[]> =>
  rpc.request.getHistory({ connectionId, limit, offset });

export const getAllHistory = (
  filters?: HistoryFilters | null
): Promise<HistoryEntry[]> => rpc.request.getAllHistory({ filters });

export const getConnections = (): Promise<DatabaseConnection[]> =>
  rpc.request.getConnections({} as never);

export const saveConnections = (
  connections: DatabaseConnection[]
): Promise<void> => rpc.request.saveConnections({ connections });

export const resetSecrets = (): Promise<void> =>
  rpc.request.resetSecrets({} as never);

export const getConfig = () => rpc.request.getConfig({} as never);
export const saveConfig = (
  config: Parameters<typeof rpc.request.saveConfig>[0]["config"]
) => rpc.request.saveConfig({ config });

export const getUpdateChannel = (): Promise<UpdateChannel> =>
  rpc.request.getUpdateChannel({} as never);
export const setUpdateChannel = (
  channel: UpdateChannel
): Promise<UpdateChannel> => rpc.request.setUpdateChannel({ channel });
export const checkForUpdate = (): Promise<AvailableUpdate | null> =>
  rpc.request.checkForUpdate({} as never);
export const installUpdate = (): Promise<boolean> =>
  rpc.request.installUpdate({} as never);

export const openExternal = (url: string): Promise<void> =>
  rpc.request.openExternal({ url });

export const toggleWindowMaximize = (): Promise<boolean> =>
  rpc.request.toggleWindowMaximize({} as never);

export type ExplainEngine = "postgresql" | "mysql" | "clickhouse" | "duckdb";
