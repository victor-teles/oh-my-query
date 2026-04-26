export type DialectType =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "clickhouse"
  | "duckdb"
  | "tsql"
  | "snowflake"
  | "bigquery"
  | "redshift"
  | "oracle";

export interface ConnectionParams {
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  authSource?: string | null;
  trustServerCertificate?: boolean | null;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface QueryParams {
  connectionId: string;
  sql: string;
  maxRows?: number | null;
  timeoutSecs?: number | null;
  schema?: string | null;
  sourceDialect?: string | null;
  queryId?: string | null;
}

export interface ColumnInfo {
  name: string;
  typeName: string;
}

export type CellValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: CellValue }
  | CellValue[];

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
