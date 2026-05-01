import type {
  AppConfig,
  ConnectionParams,
  DatabaseConnection,
  ExecuteResult,
  ExplainParams,
  ExplainResult,
  HistoryEntry,
  HistoryFilters,
  QueryParams,
  RedisDbInfo,
  RedisScanPage,
  SchemaInfo,
  TabState,
  TestConnectionResult,
} from "@oh-my-query/core";

export type UpdateChannel = "stable" | "beta" | "nightly";

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export interface ScanRedisKeysParams {
  connectionId: string;
  dbIndex: number;
  pattern?: string | null;
  cursor?: string | null;
  count?: number | null;
}

export interface DeleteRedisKeyParams {
  connectionId: string;
  dbIndex: number;
  name: string;
}

export interface RpcSchema {
  requests: {
    testConnection: {
      params: { params: ConnectionParams };
      response: TestConnectionResult;
    };
    connectToDatabase: {
      params: { connectionId: string; params: ConnectionParams };
      response: void;
    };
    disconnectFromDatabase: {
      params: { connectionId: string };
      response: void;
    };
    getServerVersion: {
      params: { connectionId: string };
      response: string;
    };
    listConnectionDatabases: {
      params: { connectionId: string };
      response: string[];
    };
    getSchema: {
      params: {
        connectionId: string;
        databaseName: string;
        force?: boolean;
      };
      response: SchemaInfo;
    };
    executeQuery: {
      params: { params: QueryParams };
      response: ExecuteResult;
    };
    explainQuery: {
      params: { params: ExplainParams };
      response: ExplainResult;
    };
    cancelQuery: {
      params: { queryId: string };
      response: boolean;
    };
    formatSql: {
      params: { sql: string; dialect: string };
      response: string;
    };

    redisDbInfo: {
      params: { connectionId: string; dbIndex: number };
      response: RedisDbInfo;
    };
    scanRedisKeys: {
      params: ScanRedisKeysParams;
      response: RedisScanPage;
    };
    deleteRedisKey: {
      params: DeleteRedisKeyParams;
      response: number;
    };

    getConfig: { params: Record<string, never>; response: AppConfig };
    saveConfig: { params: { config: AppConfig }; response: void };
    getTabs: {
      params: { connectionId: string };
      response: TabState | null;
    };
    saveTabs: {
      params: { connectionId: string; state: TabState };
      response: void;
    };
    appendHistory: { params: { entry: HistoryEntry }; response: void };
    getHistory: {
      params: {
        connectionId: string;
        limit?: number | null;
        offset?: number | null;
      };
      response: HistoryEntry[];
    };
    getAllHistory: {
      params: { filters?: HistoryFilters | null };
      response: HistoryEntry[];
    };
    getConnections: {
      params: Record<string, never>;
      response: DatabaseConnection[];
    };
    saveConnections: {
      params: { connections: DatabaseConnection[] };
      response: void;
    };
    resetSecrets: {
      params: Record<string, never>;
      response: void;
    };

    getUpdateChannel: {
      params: Record<string, never>;
      response: UpdateChannel;
    };
    setUpdateChannel: {
      params: { channel: UpdateChannel };
      response: UpdateChannel;
    };
    checkForUpdate: {
      params: Record<string, never>;
      response: AvailableUpdate | null;
    };
    installUpdate: { params: Record<string, never>; response: boolean };

    openExternal: { params: { url: string }; response: void };

    toggleWindowMaximize: {
      params: Record<string, never>;
      response: boolean;
    };

    rendererReady: {
      params: Record<string, never>;
      response: void;
    };
  };
  messages: {
    menuNavigate: { route: string };
    updateProgress: { percent: number; downloaded: number; total: number };
  };
}
