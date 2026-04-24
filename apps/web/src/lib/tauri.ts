import type { DatabaseConnection } from "@/lib/connections";

interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

export const isMacOS = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac/i.test(navigator.userAgent);
};

export const testConnection = async (
  connection: Omit<
    DatabaseConnection,
    "id" | "name" | "createdAt" | "pinned" | "lastConnectedAt"
  >
): Promise<TestConnectionResult> => {
  if (!isTauri()) {
    return {
      latencyMs: 0,
      message: "Simulated connection (browser mode)",
      success: true,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");

  const result = await invoke<TestConnectionResult>("test_connection", {
    params: {
      authSource: connection.authSource,
      database: connection.database,
      host: connection.host,
      password: connection.password,
      port: connection.port,
      type: connection.type,
      username: connection.username,
    },
  });

  return result;
};

export interface QueryParams {
  connectionId: string;
  sql: string;
  maxRows?: number;
  timeoutSecs?: number;
  schema?: string;
  sourceDialect?: string;
  queryId?: string;
}

export interface ColumnInfo {
  name: string;
  typeName: string;
}

export interface TabularResult {
  resultType: "tabular";
  columns: ColumnInfo[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
  isTruncated: boolean;
}

export interface DocumentResult {
  resultType: "documents";
  documents: unknown[];
  count: number;
  executionTimeMs: number;
  isTruncated: boolean;
}

export type ExecuteResult = TabularResult | DocumentResult;

export type QueryResult = TabularResult;

export interface SchemaInfo {
  schemas: SchemaItem[];
}

export interface SchemaItem {
  name: string;
  tables: TableItem[];
  views: ViewItem[];
}

export interface TableItem {
  name: string;
  columns: ColumnDetail[];
  indexes: IndexItem[];
  foreignKeys: ForeignKeyItem[];
  rowEstimate: number | null;
}

export interface ViewItem {
  name: string;
  columns: ColumnDetail[];
}

export interface ColumnDetail {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
}

export interface IndexItem {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ForeignKeyItem {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export const connectToDatabase = async (
  connectionId: string,
  connection: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<void> => {
  if (!isTauri()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("connect_to_database", {
    connectionId,
    params: {
      authSource: connection.authSource,
      database: connection.database,
      host: connection.host,
      password: connection.password,
      port: connection.port,
      type: connection.type,
      username: connection.username,
    },
  });
};

export const getServerVersion = async (
  connectionId: string
): Promise<string> => {
  if (!isTauri()) {
    return "PostgreSQL 16.2";
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("get_server_version", { connectionId });
};

export const disconnectFromDatabase = async (
  connectionId: string
): Promise<void> => {
  if (!isTauri()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("disconnect_from_database", { connectionId });
};

const MOCK_EXECUTE_RESULT: ExecuteResult = {
  columns: [
    { name: "id", typeName: "INT4" },
    { name: "name", typeName: "TEXT" },
    { name: "active", typeName: "BOOL" },
  ],
  executionTimeMs: 42,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 3,
  rows: [
    [1, "Alice", true],
    [2, "Bob", false],
    [3, "Charlie", true],
  ],
};

export const executeQuery = async (
  params: QueryParams
): Promise<ExecuteResult> => {
  if (!isTauri()) {
    return MOCK_EXECUTE_RESULT;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  return invoke<ExecuteResult>("execute_query", { params });
};

export const cancelQuery = async (queryId: string): Promise<boolean> => {
  if (!isTauri()) {
    return false;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("cancel_query", { queryId });
};

export type ExplainEngine = "postgresql" | "mysql" | "clickhouse" | "duckdb";

export interface PlanCost {
  startup: number | null;
  total: number | null;
  actualTotalMs: number | null;
  selfMs: number | null;
}

export interface PlanRows {
  estimated: number | null;
  actual: number | null;
}

export interface PlanTiming {
  actualTotalMs: number | null;
  loops: number | null;
  startupMs: number | null;
}

export interface PlanNode {
  id: string;
  nodeType: string;
  label: string;
  cost: PlanCost;
  rows: PlanRows;
  timing: PlanTiming;
  warnings: string[];
  details: [string, string][];
  children: PlanNode[];
}

export interface ExplainResult {
  engine: ExplainEngine;
  root: PlanNode;
  raw: string;
  analyzeRan: boolean;
  supportsAnalyze: boolean;
  executionTimeMs: number;
}

export interface ExplainParams {
  connectionId: string;
  sql: string;
  analyze?: boolean;
  schema?: string;
  sourceDialect?: string;
  queryId?: string;
  timeoutSecs?: number;
}

const MOCK_EXPLAIN_RESULT: ExplainResult = {
  analyzeRan: false,
  engine: "postgresql",
  executionTimeMs: 8,
  raw: '[{"Plan": {"Node Type": "Hash Join", "Plans": [...] }}]',
  root: {
    children: [
      {
        children: [],
        cost: {
          actualTotalMs: 4.1,
          selfMs: 4.1,
          startup: 0,
          total: 120.3,
        },
        details: [
          ["Relation Name", "users"],
          ["Alias", "u"],
        ],
        id: "p.0",
        label: "Seq Scan on users (u)",
        nodeType: "Seq Scan",
        rows: { actual: 10_000, estimated: 10_000 },
        timing: { actualTotalMs: 4.1, loops: 1, startupMs: 0 },
        warnings: ["Sequential scan"],
      },
      {
        children: [],
        cost: {
          actualTotalMs: 1.2,
          selfMs: 1.2,
          startup: 0,
          total: 55.7,
        },
        details: [["Relation Name", "orders"]],
        id: "p.1",
        label: "Index Scan using orders_pkey on orders",
        nodeType: "Index Scan",
        rows: { actual: 1200, estimated: 1100 },
        timing: { actualTotalMs: 1.2, loops: 1, startupMs: 0 },
        warnings: [],
      },
    ],
    cost: {
      actualTotalMs: 6.2,
      selfMs: 0.9,
      startup: 10,
      total: 180.5,
    },
    details: [],
    id: "p",
    label: "Hash Join",
    nodeType: "Hash Join",
    rows: { actual: 11_000, estimated: 11_000 },
    timing: { actualTotalMs: 6.2, loops: 1, startupMs: 2 },
    warnings: [],
  },
  supportsAnalyze: true,
};

export const ENGINE_SUPPORTS_EXPLAIN: Record<string, boolean> = {
  clickhouse: true,
  duckdb: true,
  mongodb: false,
  mssql: false,
  mysql: true,
  postgresql: true,
  redis: false,
  sqlite: false,
};

export const ENGINE_SUPPORTS_ANALYZE: Record<string, boolean> = {
  clickhouse: false,
  duckdb: true,
  mysql: false,
  postgresql: true,
};

export const explainQuery = async (
  params: ExplainParams
): Promise<ExplainResult> => {
  if (!isTauri()) {
    return MOCK_EXPLAIN_RESULT;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ExplainResult>("explain_query", { params });
};

const MOCK_SCHEMA: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: "nextval('users_id_seq')",
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "name",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: true,
              isPrimaryKey: false,
              name: "email",
            },
            {
              dataType: "boolean",
              defaultValue: "true",
              isNullable: false,
              isPrimaryKey: false,
              name: "active",
            },
            {
              dataType: "timestamp",
              defaultValue: "now()",
              isNullable: false,
              isPrimaryKey: false,
              name: "created_at",
            },
          ],
          foreignKeys: [],
          indexes: [
            { columns: ["id"], isUnique: true, name: "users_pkey" },
            { columns: ["email"], isUnique: true, name: "users_email_idx" },
          ],
          name: "users",
          rowEstimate: 12_400,
        },
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "user_id",
            },
            {
              dataType: "numeric",
              defaultValue: "0",
              isNullable: false,
              isPrimaryKey: false,
              name: "total",
            },
            {
              dataType: "text",
              defaultValue: "'pending'",
              isNullable: false,
              isPrimaryKey: false,
              name: "status",
            },
            {
              dataType: "timestamp",
              defaultValue: "now()",
              isNullable: false,
              isPrimaryKey: false,
              name: "created_at",
            },
          ],
          foreignKeys: [
            {
              columns: ["user_id"],
              name: "orders_user_id_fkey",
              referencedColumns: ["id"],
              referencedTable: "users",
            },
          ],
          indexes: [
            { columns: ["id"], isUnique: true, name: "orders_pkey" },
            {
              columns: ["user_id"],
              isUnique: false,
              name: "orders_user_id_idx",
            },
          ],
          name: "orders",
          rowEstimate: 84_120,
        },
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "name",
            },
            {
              dataType: "numeric",
              defaultValue: "0",
              isNullable: false,
              isPrimaryKey: false,
              name: "price",
            },
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: true,
              isPrimaryKey: false,
              name: "category_id",
            },
          ],
          foreignKeys: [
            {
              columns: ["category_id"],
              name: "products_category_id_fkey",
              referencedColumns: ["id"],
              referencedTable: "categories",
            },
          ],
          indexes: [{ columns: ["id"], isUnique: true, name: "products_pkey" }],
          name: "products",
          rowEstimate: 1240,
        },
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "name",
            },
          ],
          foreignKeys: [],
          indexes: [
            { columns: ["id"], isUnique: true, name: "categories_pkey" },
          ],
          name: "categories",
          rowEstimate: 42,
        },
      ],
      views: [
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "id",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "name",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: true,
              isPrimaryKey: false,
              name: "email",
            },
          ],
          name: "active_users",
        },
        {
          columns: [
            {
              dataType: "integer",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "user_id",
            },
            {
              dataType: "bigint",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "total_orders",
            },
            {
              dataType: "numeric",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "total_amount",
            },
          ],
          name: "order_summary",
        },
      ],
    },
  ],
};

export const listDatabases = async (
  connectionId: string
): Promise<string[]> => {
  if (!isTauri()) {
    return ["public"];
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string[]>("list_connection_databases", { connectionId });
};

export const getSchema = async (
  connectionId: string,
  databaseName: string
): Promise<SchemaInfo> => {
  if (!isTauri()) {
    return MOCK_SCHEMA;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SchemaInfo>("get_schema", { connectionId, databaseName });
};

export type RedisKeyKind =
  | "STRING"
  | "HASH"
  | "LIST"
  | "SET"
  | "ZSET"
  | "STREAM"
  | "UNKNOWN";

export type RedisSizeUnit =
  | "bytes"
  | "fields"
  | "items"
  | "members"
  | "entries"
  | "";

export interface RedisKey {
  name: string;
  kind: RedisKeyKind;
  ttlSecs: number | null;
  size: number | null;
  sizeUnit: RedisSizeUnit;
}

export interface RedisScanPage {
  keys: RedisKey[];
  nextCursor: string;
  sampled: number;
}

export interface RedisDbInfo {
  totalKeys: number;
  memoryBytes: number | null;
}

const MOCK_REDIS_KEYS: RedisKey[] = [
  {
    kind: "STRING",
    name: "hello",
    size: 11,
    sizeUnit: "bytes",
    ttlSecs: null,
  },
  {
    kind: "HASH",
    name: "user:1",
    size: 5,
    sizeUnit: "fields",
    ttlSecs: 300,
  },
  {
    kind: "HASH",
    name: "user:2",
    size: 4,
    sizeUnit: "fields",
    ttlSecs: null,
  },
  {
    kind: "ZSET",
    name: "leaderboard",
    size: 100,
    sizeUnit: "members",
    ttlSecs: null,
  },
  {
    kind: "LIST",
    name: "queue:emails",
    size: 23,
    sizeUnit: "items",
    ttlSecs: null,
  },
  {
    kind: "SET",
    name: "session:abc",
    size: 8,
    sizeUnit: "members",
    ttlSecs: 45,
  },
  {
    kind: "STREAM",
    name: "events:audit",
    size: 1234,
    sizeUnit: "entries",
    ttlSecs: null,
  },
];

export const redisDbInfo = async (
  connectionId: string,
  dbIndex: number
): Promise<RedisDbInfo> => {
  if (!isTauri()) {
    return { memoryBytes: 1_234_567, totalKeys: MOCK_REDIS_KEYS.length };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RedisDbInfo>("redis_db_info", { connectionId, dbIndex });
};

export const scanRedisKeys = async (params: {
  connectionId: string;
  dbIndex: number;
  pattern?: string | null;
  cursor?: string | null;
  count?: number | null;
}): Promise<RedisScanPage> => {
  if (!isTauri()) {
    return {
      keys: MOCK_REDIS_KEYS,
      nextCursor: "0",
      sampled: MOCK_REDIS_KEYS.length,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RedisScanPage>("scan_redis_keys", {
    connectionId: params.connectionId,
    count: params.count ?? null,
    cursor: params.cursor ?? null,
    dbIndex: params.dbIndex,
    pattern: params.pattern ?? null,
  });
};

export const deleteRedisKey = async (params: {
  connectionId: string;
  dbIndex: number;
  name: string;
}): Promise<number> => {
  if (!isTauri()) {
    return 1;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("delete_redis_key", {
    connectionId: params.connectionId,
    dbIndex: params.dbIndex,
    name: params.name,
  });
};
