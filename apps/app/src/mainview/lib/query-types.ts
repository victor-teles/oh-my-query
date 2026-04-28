import type { PendingExecution } from "@/lib/persistence";
import type { ExecuteResult, ExplainResult } from "@/lib/tauri";

export type TabStatus = "idle" | "running" | "success" | "error";

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
  runningExplainId: string | null;
}
