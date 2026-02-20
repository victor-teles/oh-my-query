import type { ExecuteResult } from "@/lib/tauri";

export type TabStatus = "idle" | "running" | "success" | "error";

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: ExecuteResult | null;
  error: string | null;
  status: TabStatus;
  sourceDialect: string | null;
}
