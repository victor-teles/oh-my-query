// Renderer-safe entry: types + pure-data constants only.
// Excludes anything that touches keytar, the polyglot WASM runtime, or
// `node:fs`/`node:os`. Safe to import from a Vite-bundled webview.
export { DbError } from "./error.ts";
export type { DbErrorShape } from "./error.ts";
export { redactPii } from "./pii-redactor.ts";
export type { RedactOptions, RedactResult } from "./pii-redactor.ts";
export {
  classifyStandardSql,
  matchRule,
  normalizeSqlForAnalysis,
} from "./safe-mode.ts";
export type {
  DestructiveClassification,
  DestructiveClassifier,
  DestructiveKind,
  DestructiveRule,
} from "./safe-mode.ts";
export type { AISettings, AppConfig } from "./config.ts";
export type {
  ExplainEngine,
  ExplainParams,
  ExplainResult,
  PlanCost,
  PlanNode,
  PlanRows,
  PlanTiming,
} from "./explain.ts";
export { ENGINE_SUPPORTS_ANALYZE, ENGINE_SUPPORTS_EXPLAIN } from "./explain.ts";
export type {
  DatabaseConnection,
  HistoryEntry,
  HistoryFilters,
  PersistedRunConfig,
  PersistedTab,
  TabState,
} from "./persistence.ts";
export type {
  CellValue,
  ColumnDetail,
  ColumnInfo,
  ConnectionParams,
  DialectType,
  DocumentResult,
  ExecuteResult,
  ForeignKeyItem,
  IndexItem,
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
  TabularResult,
  TestConnectionResult,
  ViewItem,
} from "./types.ts";
