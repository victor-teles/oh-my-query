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
export {
  compileSqlTemplate,
  DATE_PRESETS,
  formatIsoDate,
  maskTemplateInputs,
  RANGE_PRESETS,
  resolveDatePreset,
  resolvePreset,
  templateInputNames,
  tokenizeSqlTemplate,
} from "./sql-template.ts";
export {
  classifyLookupValue,
  LOOKUP_KINDS,
  MAX_LOOKUP_INPUT,
} from "./lookup-value.ts";
export type { LookupKind, LookupValue } from "./lookup-value.ts";
export type { LookupSkips } from "./lookup-plan.ts";
export type {
  SqlAssumption,
  SqlAssumptions,
  TimeGrain,
} from "./sql-assumptions.ts";
export {
  limitedSelect,
  PREVIEW_ROWS,
  previewSql,
  qualifiedTable,
  quoteIdentifier,
} from "./sql-identifiers.ts";
export type {
  CompiledTemplate,
  DatePreset,
  IsoRange,
  RangePart,
  RangePreset,
  TemplateSegment,
  TemplateValue,
  WeekStart,
} from "./sql-template.ts";
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
  BindValue,
  CellValue,
  ColumnDetail,
  ColumnInfo,
  ConnectionParams,
  DialectType,
  DocumentResult,
  ExecuteResult,
  ForeignKeyItem,
  IndexItem,
  QueryLanguage,
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
export { isSqlDialect } from "./types.ts";
export { flattenRecords } from "./flatten.ts";
export type { FlattenOptions } from "./flatten.ts";
export {
  MONGO_MAX_QUERY_BYTES,
  MONGO_MAX_STAGES,
  MONGO_READ_STAGES,
  parseMongoReadQuery,
} from "./mongo-read-query.ts";
export type {
  MongoReadQuery,
  MongoReadQueryParse,
} from "./mongo-read-query.ts";
export {
  parseRedisReadPlan,
  REDIS_MAX_ARG_LENGTH,
  REDIS_MAX_ARGS,
  REDIS_MAX_COMMANDS,
  REDIS_MAX_RANGE,
  REDIS_READ_COMMANDS,
  redisCommandShape,
} from "./redis-read-plan.ts";
export type {
  RedisCommandShape,
  RedisReadCommand,
  RedisReadPlan,
  RedisReadPlanParse,
} from "./redis-read-plan.ts";
