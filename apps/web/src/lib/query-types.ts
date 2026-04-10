import type { ExecuteResult } from "@/lib/tauri";

export type TabStatus = "idle" | "running" | "success" | "error";

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  executedSql: string | null;
  result: ExecuteResult | null;
  error: string | null;
  status: TabStatus;
  sourceDialect: string | null;
}
