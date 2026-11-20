import type { LookupSkips, LookupValue } from "@conch/core/client";

import { classifyLookupValue, MAX_LOOKUP_INPUT } from "@conch/core/client";
import { z } from "zod";

const sameAsClassified = (value: LookupValue): boolean => {
  const classified = classifyLookupValue(value.value);
  return (
    classified !== null &&
    classified.kind === value.kind &&
    classified.value === value.value
  );
};

export const LookupValueSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("uuid"),
      value: z.string().max(MAX_LOOKUP_INPUT),
    }),
    z.object({
      kind: z.literal("email"),
      value: z.string().max(MAX_LOOKUP_INPUT),
    }),
    z.object({
      kind: z.literal("integer"),
      value: z.string().max(MAX_LOOKUP_INPUT),
    }),
  ])
  .refine(sameAsClassified, "That value isn't an id or email.");

export const LookupRequest = z.object({
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  lookupId: z.string().min(1).max(100),
  value: LookupValueSchema,
});
export type LookupRequest = z.infer<typeof LookupRequest>;

export interface LookupHit {
  rank: number;
  schema: string;
  table: string;
  column: string;
  matchedRows: number;
  capped: boolean;
  elapsedMs: number;
}

export type LookupErrorCode =
  | "NO_CANDIDATES"
  | "UNSUPPORTED_ENGINE"
  | "CONNECTION_MISSING"
  | "FAILED"
  | "CANCELLED";

export type LookupEvent =
  | { type: "planned"; probes: number; tables: number; skipped: LookupSkips }
  | { type: "hit"; hit: LookupHit }
  | { type: "progress"; done: number; total: number }
  | {
      type: "probeFailed";
      table: string;
      column: string;
      reason: "timeout" | "error";
    }
  | { type: "done"; elapsedMs: number; budgetExceeded: boolean }
  | { type: "error"; code: LookupErrorCode; message: string };

export interface LookupEventMessage {
  lookupId: string;
  event: LookupEvent;
}
