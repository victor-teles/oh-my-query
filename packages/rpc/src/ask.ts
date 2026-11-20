import type { ColumnInfo, QueryLanguage } from "@conch/core";

import type { CardSpec } from "./card-spec.ts";
import type { RefineContext } from "./refine.ts";

export type AskPhase = "schema" | "sql" | "run" | "present";

export type AskErrorCode =
  | "NO_AI_SETTINGS"
  | "AI_AUTH"
  | "AI_RATE_LIMIT"
  | "AI_NETWORK"
  | "UNSUPPORTED_ENGINE"
  | "NOT_READ_ONLY"
  | "QUERY_FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_SPEC";

export type AskEvent =
  | { type: "phase"; phase: AskPhase; detail: string }
  | { type: "sqlDelta"; text: string }
  | { type: "sqlReset"; reason: string }
  | { type: "sqlDone"; sql: string; dialect: QueryLanguage; lines: number }
  | {
      type: "result";
      columns: ColumnInfo[];
      rows: unknown[][];
      rowCount: number;
      executionTimeMs: number;
      isTruncated: boolean;
    }
  | { type: "card"; spec: CardSpec; source: "model" | "inferred" }
  | {
      type: "error";
      phase: AskPhase;
      code: AskErrorCode;
      message: string;
      sql?: string;
    }
  | { type: "done" };

export type AskResultEvent = Extract<AskEvent, { type: "result" }>;

export interface AskParams {
  askId: string;
  connectionId: string;
  database: string | null;
  prompt: string;
  refine?: RefineContext;
}

export interface AskEventMessage {
  askId: string;
  event: AskEvent;
}
