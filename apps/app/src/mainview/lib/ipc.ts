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
import { decodeRpcError } from "@oh-my-query/rpc";
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

const bunReadyHandlers = new Set<() => void>();
const bunReadyState = { fired: false };

const definedRpc = Electroview.defineRPC<AppRpcSchema>({
  handlers: {
    messages: {
      menuNavigate: (payload) => messageHandlers.menuNavigate?.(payload),
      updateProgress: (payload) => messageHandlers.updateProgress?.(payload),
    },
    requests: {},
  },
  // Long queries may legitimately run for minutes; cancelQuery is the
  // user-driven recovery path for hung calls, not a transport-level timeout.
  maxRequestTime: Number.POSITIVE_INFINITY,
});

const BROWSER_CONNECTIONS_KEY = "oh-my-query-connections";

const isElectrobunHost = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    (window as Window & { __electrobunWebviewId?: number })
      .__electrobunWebviewId !== undefined
  );
};

const readBrowserConnections = (): DatabaseConnection[] => {
  if (typeof localStorage === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(BROWSER_CONNECTIONS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DatabaseConnection[]) : [];
  } catch {
    return [];
  }
};

// Browser mode is only used by vite-only dev and Playwright e2e — never the
// production path. Strip credentials before localStorage so a passing dev
// session can't accidentally leak passwords to disk.
const stripBrowserSecrets = (
  connection: DatabaseConnection
): DatabaseConnection => ({
  ...connection,
  password: "",
});

const writeBrowserConnections = (connections: DatabaseConnection[]): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  const sanitized = connections.map(stripBrowserSecrets);
  localStorage.setItem(BROWSER_CONNECTIONS_KEY, JSON.stringify(sanitized));
};

const dispatchBrowserRequest = (prop: string, payload: unknown): unknown => {
  switch (prop) {
    case "rendererReady": {
      return undefined;
    }
    case "getConnections": {
      return readBrowserConnections();
    }
    case "saveConnections": {
      writeBrowserConnections(
        (payload as { connections: DatabaseConnection[] }).connections
      );
      return undefined;
    }
    case "getConfig": {
      return {};
    }
    case "saveConfig": {
      return undefined;
    }
    case "getUpdateChannel": {
      return "stable";
    }
    case "getTabs": {
      return null;
    }
    case "getAllHistory":
    case "getHistory": {
      return [];
    }
    default: {
      throw new Error(`Browser-mode IPC stub does not implement '${prop}'`);
    }
  }
};

// Used when the renderer runs without an Electrobun host (vite-only dev,
// Playwright e2e). Persistence drops to localStorage so the shell still boots.
const createBrowserRequestStub = (): Record<
  string,
  (payload?: unknown) => Promise<unknown>
> =>
  new Proxy(
    {},
    {
      get:
        (_target, prop: string) =>
        (payload?: unknown): Promise<unknown> => {
          try {
            return Promise.resolve(dispatchBrowserRequest(prop, payload));
          } catch (error) {
            return Promise.reject(error);
          }
        },
    }
  );

const createElectroview = () => new Electroview({ rpc: definedRpc });

const buildRequest = (): NonNullable<
  ReturnType<typeof createElectroview>["rpc"]
>["request"] => {
  if (isElectrobunHost()) {
    const electroview = createElectroview();
    if (!electroview.rpc) {
      throw new Error("Electroview RPC client failed to initialize");
    }
    return electroview.rpc.request;
  }
  return createBrowserRequestStub() as never;
};

const request = buildRequest();

const handshake = async (): Promise<void> => {
  try {
    await request.rendererReady({});
    bunReadyState.fired = true;
    for (const handler of bunReadyHandlers) {
      handler();
    }
  } catch (error) {
    console.error("[ipc] rendererReady handshake failed", error);
  }
};

// oxlint-disable-next-line jest/require-hook
handshake();

const callRpc = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw decodeRpcError(error);
  }
};

export function onMenuNavigate(handler: (route: string) => void): () => void {
  messageHandlers.menuNavigate = (payload) => handler(payload.route);
  return () => {
    messageHandlers.menuNavigate = undefined;
  };
}

export function onBunReady(handler: () => void): () => void {
  bunReadyHandlers.add(handler);
  if (bunReadyState.fired) {
    handler();
  }
  return () => {
    bunReadyHandlers.delete(handler);
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
  callRpc(() => request.testConnection({ params: paramsFor(conn) }));

export const connectToDatabase = (
  connectionId: string,
  conn: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<void> =>
  callRpc(() =>
    request.connectToDatabase({ connectionId, params: paramsFor(conn) })
  );

export const disconnectFromDatabase = (connectionId: string): Promise<void> =>
  callRpc(() => request.disconnectFromDatabase({ connectionId }));

export const getServerVersion = (connectionId: string): Promise<string> =>
  callRpc(() => request.getServerVersion({ connectionId }));

export const listDatabases = (connectionId: string): Promise<string[]> =>
  callRpc(() => request.listConnectionDatabases({ connectionId }));

export const getSchema = (
  connectionId: string,
  databaseName: string
): Promise<SchemaInfo> =>
  callRpc(() => request.getSchema({ connectionId, databaseName }));

export const executeQuery = (params: QueryParams): Promise<ExecuteResult> =>
  callRpc(() => request.executeQuery({ params }));

export const explainQuery = (params: ExplainParams): Promise<ExplainResult> =>
  callRpc(() => request.explainQuery({ params }));

export const cancelQuery = (queryId: string): Promise<boolean> =>
  callRpc(() => request.cancelQuery({ queryId }));

export const formatSql = (sql: string, dialect: string): Promise<string> =>
  callRpc(() => request.formatSql({ dialect, sql }));

export const redisDbInfo = (
  connectionId: string,
  dbIndex: number
): Promise<RedisDbInfo> =>
  callRpc(() => request.redisDbInfo({ connectionId, dbIndex }));

export const scanRedisKeys = (params: {
  connectionId: string;
  dbIndex: number;
  pattern?: string | null;
  cursor?: string | null;
  count?: number | null;
}): Promise<RedisScanPage> => callRpc(() => request.scanRedisKeys(params));

export const deleteRedisKey = (params: {
  connectionId: string;
  dbIndex: number;
  name: string;
}): Promise<number> => callRpc(() => request.deleteRedisKey(params));

export const getTabs = (connectionId: string): Promise<TabState | null> =>
  callRpc(() => request.getTabs({ connectionId }));

export const saveTabs = (
  connectionId: string,
  state: TabState
): Promise<void> => callRpc(() => request.saveTabs({ connectionId, state }));

export const appendHistory = (entry: HistoryEntry): Promise<void> =>
  callRpc(() => request.appendHistory({ entry }));

export const getHistory = (
  connectionId: string,
  limit?: number | null,
  offset?: number | null
): Promise<HistoryEntry[]> =>
  callRpc(() => request.getHistory({ connectionId, limit, offset }));

export const getAllHistory = (
  filters?: HistoryFilters | null
): Promise<HistoryEntry[]> => callRpc(() => request.getAllHistory({ filters }));

export const getConnections = (): Promise<DatabaseConnection[]> =>
  callRpc(() => request.getConnections({} as never));

export const saveConnections = (
  connections: DatabaseConnection[]
): Promise<void> => callRpc(() => request.saveConnections({ connections }));

export const resetSecrets = (): Promise<void> =>
  callRpc(() => request.resetSecrets({} as never));

export const getConfig = () => callRpc(() => request.getConfig({} as never));
export const saveConfig = (
  config: Parameters<typeof request.saveConfig>[0]["config"]
) => callRpc(() => request.saveConfig({ config }));

export const getUpdateChannel = (): Promise<UpdateChannel> =>
  callRpc(() => request.getUpdateChannel({} as never));
export const setUpdateChannel = (
  channel: UpdateChannel
): Promise<UpdateChannel> =>
  callRpc(() => request.setUpdateChannel({ channel }));
export const checkForUpdate = (): Promise<AvailableUpdate | null> =>
  callRpc(() => request.checkForUpdate({} as never));
export const installUpdate = (): Promise<boolean> =>
  callRpc(() => request.installUpdate({} as never));

export const openExternal = (url: string): Promise<void> =>
  callRpc(() => request.openExternal({ url }));

export const toggleWindowMaximize = (): Promise<boolean> =>
  callRpc(() => request.toggleWindowMaximize({} as never));

export type ExplainEngine = "postgresql" | "mysql" | "clickhouse" | "duckdb";
