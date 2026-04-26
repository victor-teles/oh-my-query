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

export interface ExplainParams {
  connectionId: string;
  sql: string;
  analyze?: boolean;
  schema?: string | null;
  sourceDialect?: string | null;
  queryId?: string | null;
  timeoutSecs?: number | null;
}

export interface ExplainResult {
  engine: ExplainEngine;
  root: PlanNode;
  raw: string;
  analyzeRan: boolean;
  supportsAnalyze: boolean;
  executionTimeMs: number;
}

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
