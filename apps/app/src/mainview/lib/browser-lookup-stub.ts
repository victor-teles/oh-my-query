import type { ColumnInfo, LookupValue } from "@oh-my-query/core/client";
import type {
  LookupEvent,
  LookupHit,
  LookupRequest,
  RpcSchema,
  SqlRunSource,
} from "@oh-my-query/rpc";

import { classifyLookupValue } from "@oh-my-query/core/client";

type EmitLookupEvent = (payload: RpcSchema["messages"]["lookupEvent"]) => void;
type Step = [delayMs: number, event: LookupEvent];

export const DEMO_LOOKUP_UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";
export const DEMO_LOOKUP_EMAIL = "ada@example.com";
export const SLOW_LOOKUP_EMAIL = "slow@example.com";

interface DemoHit {
  table: string;
  column: string;
  rows: number;
}

interface DemoLookup {
  tables: number;
  probeMs: number;
  hits: DemoHit[];
}

const PROBE_MS = 20;
const PLAN_MS = 60;
const HIT_GAPS = [80, 160, 250];

const NO_HITS: DemoLookup = { hits: [], probeMs: PROBE_MS, tables: 14 };

const DEMOS: Record<string, DemoLookup> = {
  "42": {
    hits: [{ column: "id", rows: 1, table: "orders" }],
    probeMs: PROBE_MS,
    tables: 9,
  },
  [DEMO_LOOKUP_EMAIL]: {
    hits: [
      { column: "email", rows: 1, table: "users" },
      { column: "billing_email", rows: 3, table: "invoices" },
    ],
    probeMs: PROBE_MS,
    tables: 6,
  },
  [DEMO_LOOKUP_UUID]: {
    hits: [
      { column: "id", rows: 1, table: "users" },
      { column: "user_id", rows: 12, table: "orders" },
      { column: "actor_id", rows: 101, table: "events" },
    ],
    probeMs: PROBE_MS,
    tables: 14,
  },
  [SLOW_LOOKUP_EMAIL]: { hits: [], probeMs: 600, tables: 12 },
};

const demoFor = (value: LookupValue): DemoLookup =>
  DEMOS[value.value] ?? NO_HITS;

const hitOf = (hit: DemoHit, rank: number): LookupHit => ({
  capped: hit.rows > 100,
  column: hit.column,
  elapsedMs: 4 + rank,
  matchedRows: Math.min(hit.rows, 100),
  rank,
  schema: "public",
  table: hit.table,
});

export const lookupScriptFor = (value: LookupValue): Step[] => {
  const demo = demoFor(value);
  const total = demo.tables;
  const steps: Step[] = [
    [
      PLAN_MS,
      {
        probes: total,
        skipped: { largeUnindexed: 0, outOfRange: 0, overLimit: 0 },
        tables: total,
        type: "planned",
      },
    ],
  ];
  let elapsed = PLAN_MS;
  for (let done = 1; done <= total; done += 1) {
    const rank = done - 1;
    const hit = demo.hits[rank];
    const delay = hit ? (HIT_GAPS[rank] ?? PROBE_MS) : demo.probeMs;
    elapsed += delay;
    if (hit) {
      steps.push([delay, { hit: hitOf(hit, rank), type: "hit" }]);
    }
    steps.push([hit ? 0 : delay, { done, total, type: "progress" }]);
  }
  steps.push([0, { budgetExceeded: false, elapsedMs: elapsed, type: "done" }]);
  return steps;
};

const MATCH_COLUMNS: ColumnInfo[] = [
  { name: "id", typeName: "UUID" },
  { name: "created_at", typeName: "TIMESTAMPTZ" },
  { name: "status", typeName: "TEXT" },
];

export interface MatchRecording {
  sql: string;
  columns: ColumnInfo[];
  rows: unknown[][];
  title: string;
}

type MatchSource = Extract<SqlRunSource, { kind: "match" }>;

export const matchRecordingFor = (source: MatchSource): MatchRecording => {
  const demo = demoFor(source.value).hits.find(
    (hit) => hit.table === source.table && hit.column === source.column
  );
  const count = Math.min(demo?.rows ?? 0, 50);
  return {
    columns: MATCH_COLUMNS,
    rows: Array.from({ length: count }, (_, index) => [
      `0000${index}`.slice(-4),
      `2026-11-${String((index % 28) + 1).padStart(2, "0")}T09:00:00Z`,
      index % 3 === 0 ? "paid" : "pending",
    ]),
    sql: `SELECT * FROM "${source.schema}"."${source.table}" WHERE "${source.column}" = $1 LIMIT 50`,
    title: `${source.table} · ${source.column}`,
  };
};

export const createLookupEmulator = (emit: EmitLookupEvent) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

  const clear = (lookupId: string): void => {
    for (const timer of timers.get(lookupId) ?? []) {
      clearTimeout(timer);
    }
    timers.delete(lookupId);
  };

  return {
    cancel: (lookupId: string): void => {
      if (!timers.has(lookupId)) {
        return;
      }
      clear(lookupId);
      emit({
        event: {
          code: "CANCELLED",
          message: "The search was stopped.",
          type: "error",
        },
        lookupId,
      });
    },
    lookup: (request: LookupRequest): void => {
      let at = 0;
      const scheduled = lookupScriptFor(request.value).map(([delay, event]) => {
        at += delay;
        return setTimeout(() => {
          emit({ event, lookupId: request.lookupId });
          if (event.type === "done" || event.type === "error") {
            timers.delete(request.lookupId);
          }
        }, at);
      });
      timers.set(request.lookupId, scheduled);
    },
  };
};

export const createClipboardEmulator = (enabled: () => boolean) => {
  const clipboard = { text: "" };
  Object.defineProperty(globalThis, "__omqSetClipboard", {
    configurable: true,
    value: (text: string) => {
      clipboard.text = text;
    },
  });
  return {
    offer: (): LookupValue | null =>
      enabled() ? classifyLookupValue(clipboard.text) : null,
  };
};
