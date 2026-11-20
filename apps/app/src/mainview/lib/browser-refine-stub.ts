import type { RefineContext, SqlAssumptions } from "@conch/rpc";

import type { RecordedAsk } from "@/lib/browser-ask-recordings";

import {
  QUARTERLY_REVENUE,
  REGION_REVENUE,
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
} from "@/lib/browser-ask-recordings";

const RECORDINGS = [
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
  REGION_REVENUE,
  QUARTERLY_REVENUE,
];

const SUBSCRIPTION_TABLES: SqlAssumptions["items"] = [
  { kind: "table", name: "subscriptions" },
  { kind: "table", name: "accounts" },
  { kind: "table", name: "regions" },
];
const SINCE_JANUARY = {
  column: "billed_at",
  kind: "filter",
  text: "s.billed_at >= CAST('2026-01-01' AS DATE)",
} as const;
const ACTIVE = {
  column: "status",
  kind: "filter",
  text: "s.status = 'active'",
} as const;
const TOP_500 = { kind: "limit", rows: 500 } as const;

// Kept identical to what core's describeSqlAssumptions returns for each
// recorded SQL; browser-refine-stub.test.ts checks them against it.
export const RECORDED_ASSUMPTIONS = new Map<string, SqlAssumptions>([
  [
    REVENUE_BY_REGION.sql,
    {
      items: [
        ...SUBSCRIPTION_TABLES,
        { column: "subscriptions.billed_at", grain: "month", kind: "time" },
        SINCE_JANUARY,
        ACTIVE,
        TOP_500,
      ],
    },
  ],
  [
    WEEKLY_SIGNUPS.sql,
    {
      items: [
        { kind: "table", name: "users" },
        { kind: "table", name: "plans" },
        { column: "users.created_at", grain: "week", kind: "time" },
        {
          column: "created_at",
          kind: "filter",
          text: "u.created_at >= CURRENT_DATE - INTERVAL '8 weeks'",
        },
      ],
    },
  ],
  [
    REGION_REVENUE.sql,
    {
      items: [
        ...SUBSCRIPTION_TABLES,
        { column: "subscriptions.billed_at", grain: "month", kind: "time" },
        { column: "name", kind: "filter", text: "r.name = 'Europe'" },
        SINCE_JANUARY,
        {
          column: "billed_at",
          kind: "filter",
          text: "s.billed_at < CAST('2026-10-01' AS DATE)",
        },
      ],
    },
  ],
  [
    QUARTERLY_REVENUE.sql,
    {
      items: [
        ...SUBSCRIPTION_TABLES,
        { column: "subscriptions.billed_at", grain: "quarter", kind: "time" },
        SINCE_JANUARY,
        ACTIVE,
        TOP_500,
      ],
    },
  ],
]);

export const recordedAssumptions = (sql: string): SqlAssumptions | null =>
  RECORDED_ASSUMPTIONS.get(sql) ?? null;

const EUROPE = /europe|\bonly\b/i;
const QUARTER = /quarter/i;

const baseOf = (refine: RefineContext): RecordedAsk =>
  RECORDINGS.find((recording) => recording.sql === refine.sql) ?? {
    ...REVENUE_BY_REGION,
    spec: refine.spec,
    sql: refine.sql,
  };

export const refinedRecording = (
  refine: RefineContext,
  prompt: string
): RecordedAsk => {
  if (EUROPE.test(prompt)) {
    return REGION_REVENUE;
  }
  if (QUARTER.test(prompt)) {
    return QUARTERLY_REVENUE;
  }
  const base = baseOf(refine);
  return {
    ...base,
    executionTimeMs: base.executionTimeMs + 16,
    spec: { ...base.spec, subtitle: `Refined: ${prompt}` },
  };
};
