import type { PendingExecution } from "@/lib/persistence";
import type { ExecuteResult, ExplainResult } from "@/lib/tauri";

export type TabStatus = "idle" | "running" | "success" | "error";

export type ExplainDensity = "comfortable" | "compact";

export interface RunConfig {
  sandbox: boolean;
  maxRows: number | null;
  timeoutSecs: number | null;
  schemaOverride: string | null;
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  maxRows: 100,
  sandbox: true,
  schemaOverride: null,
  timeoutSecs: null,
};

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  executedSql: string | null;
  result: ExecuteResult | null;
  error: string | null;
  errorCode: string | null;
  status: TabStatus;
  sourceDialect: string | null;
  pendingExecution: PendingExecution | null;
  runningQueryId: string | null;
  explainResult: ExplainResult | null;
  explainSql: string | null;
  explainStatus: TabStatus;
  explainError: string | null;
  explainAnalyze: boolean;
  explainDensity: ExplainDensity;
  runningExplainId: string | null;
}
