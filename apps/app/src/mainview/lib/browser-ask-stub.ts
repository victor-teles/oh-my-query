import type {
  AskEvent,
  AskParams,
  CardSpec,
  RpcSchema,
  RunSqlParams,
} from "@oh-my-query/rpc";

import type { RecordedAsk } from "@/lib/browser-ask-recordings";

import {
  MONTHS,
  REGION_MRR,
  REGION_REVENUE,
  regionRevenue,
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
} from "@/lib/browser-ask-recordings";
import { matchRecordingFor } from "@/lib/browser-lookup-stub";
import { refinedRecording } from "@/lib/browser-refine-stub";

type EmitAskEvent = (payload: RpcSchema["messages"]["askEvent"]) => void;
type MatchSource = Extract<RunSqlParams["source"], { kind: "match" }>;

const SQL_CHUNK_CHARS = 7;
const SQL_CHUNK_MS = 15;
const SCHEMA_MS = 260;
const RUN_MS = 600;
const PRESENT_MS = 500;

export {
  MONTHS,
  REGION_MRR,
  REGION_REVENUE,
  regionRevenue,
  REVENUE_BY_REGION,
  WEEKLY_SIGNUPS,
};
export type { RecordedAsk };

const REGION_PROMPT = /europe|north america|asia/i;

const REFUSED_SQL = "-- Remove every user\ndelete from users";
const MUTATION = /\b(delete|drop|truncate|update|insert)\b/i;

type Step = [delayMs: number, event: AskEvent];

const sqlSteps = (sql: string): Step[] =>
  Array.from({ length: Math.ceil(sql.length / SQL_CHUNK_CHARS) }, (_, i) => [
    SQL_CHUNK_MS,
    {
      text: sql.slice(i * SQL_CHUNK_CHARS, (i + 1) * SQL_CHUNK_CHARS),
      type: "sqlDelta",
    },
  ]);

const openingSteps = (label: string, sql: string): Step[] => [
  [
    0,
    { detail: `Reading the ${label} schema`, phase: "schema", type: "phase" },
  ],
  [SCHEMA_MS, { detail: "Writing SQL", phase: "sql", type: "phase" }],
  ...sqlSteps(sql),
  [
    0,
    {
      dialect: "postgresql",
      lines: sql.split("\n").length,
      sql,
      type: "sqlDone",
    },
  ],
];

const answerSteps = (label: string, recorded: RecordedAsk): Step[] => [
  ...openingSteps(label, recorded.sql),
  [0, { detail: `Read only on ${label}`, phase: "run", type: "phase" }],
  [
    RUN_MS,
    {
      columns: recorded.columns,
      executionTimeMs: recorded.executionTimeMs,
      isTruncated: false,
      rowCount: recorded.rows.length,
      rows: recorded.rows,
      type: "result",
    },
  ],
  [0, { detail: "Shaping the result", phase: "present", type: "phase" }],
  [PRESENT_MS, { source: "model", spec: recorded.spec, type: "card" }],
  [0, { type: "done" }],
];

const refusalSteps = (label: string): Step[] => [
  ...openingSteps(label, REFUSED_SQL),
  [
    0,
    {
      code: "NOT_READ_ONLY",
      message: "Only read-only queries can run here, not DELETE.",
      phase: "sql",
      sql: REFUSED_SQL,
      type: "error",
    },
  ],
];

export const recordedFor = (prompt: string): RecordedAsk => {
  if (REGION_PROMPT.test(prompt)) {
    return REGION_REVENUE;
  }
  return /signup/i.test(prompt) ? WEEKLY_SIGNUPS : REVENUE_BY_REGION;
};

export const scriptFor = (prompt: string, label = "demo"): Step[] => {
  if (MUTATION.test(prompt)) {
    return refusalSteps(label);
  }
  return answerSteps(label, recordedFor(prompt));
};

const recordingOf = ({ prompt, refine }: AskParams): RecordedAsk =>
  refine ? refinedRecording(refine, prompt) : recordedFor(prompt);

export const askScriptFor = (params: AskParams, label = "demo"): Step[] =>
  MUTATION.test(params.prompt)
    ? refusalSteps(label)
    : answerSteps(label, recordingOf(params));

const RAW_WRITE = /^\s*(insert|update|delete|drop|alter|truncate|create)\b/i;
const ORDER_STATUSES = ["paid", "pending", "refunded", "paid", "paid"];

export const ORDERS_PREVIEW: RecordedAsk = {
  columns: [
    { name: "id", typeName: "INT8" },
    { name: "customer_id", typeName: "INT8" },
    { name: "status", typeName: "TEXT" },
    { name: "total", typeName: "NUMERIC" },
    { name: "created_at", typeName: "TIMESTAMPTZ" },
  ],
  executionTimeMs: 12,
  rows: Array.from({ length: 50 }, (_, index) => [
    1000 + index,
    200 + (index % 17),
    ORDER_STATUSES[index % ORDER_STATUSES.length],
    String(((index * 37) % 400) + 20),
    `2026-10-${String((index % 28) + 1).padStart(2, "0")}T09:00:00Z`,
  ]),
  spec: { formats: {}, title: "Orders", version: 1, view: { kind: "table" } },
  sql: 'SELECT * FROM "public"."orders" LIMIT 50',
};

const rawRecordedFor = (sql: string): RecordedAsk => {
  if (sql.includes('"orders"')) {
    return ORDERS_PREVIEW;
  }
  return /signup/i.test(sql) ? WEEKLY_SIGNUPS : REVENUE_BY_REGION;
};

const titled = (
  { insight: _insight, subtitle: _subtitle, ...spec }: CardSpec,
  title: string
): CardSpec => ({
  ...spec,
  title: title.charAt(0).toUpperCase() + title.slice(1),
});

const matchScriptFor = (source: MatchSource): Step[] => {
  const recording = matchRecordingFor(source);
  return [
    [
      0,
      {
        dialect: "postgresql",
        lines: 1,
        sql: recording.sql,
        type: "sqlDone",
      },
    ],
    [0, { detail: "Read only", phase: "run", type: "phase" }],
    [
      RUN_MS,
      {
        columns: recording.columns,
        executionTimeMs: 6,
        isTruncated: false,
        rowCount: recording.rows.length,
        rows: recording.rows,
        type: "result",
      },
    ],
    [
      0,
      {
        source: "inferred",
        spec: {
          formats: {},
          title: recording.title,
          version: 1,
          view: { kind: "table" },
        },
        type: "card",
      },
    ],
    [0, { type: "done" }],
  ];
};

export const rawScriptFor = (params: RunSqlParams, label = "demo"): Step[] => {
  if (params.source.kind === "match") {
    return matchScriptFor(params.source);
  }
  const { sql, title } = params.source;
  const done: Step = [
    0,
    {
      dialect: "postgresql",
      lines: sql.split("\n").length,
      sql,
      type: "sqlDone",
    },
  ];
  if (RAW_WRITE.test(sql)) {
    const verb = RAW_WRITE.exec(sql)?.[1]?.toUpperCase() ?? "WRITE";
    return [
      done,
      [
        0,
        {
          code: "NOT_READ_ONLY",
          message: `Only read-only queries can run here, not ${verb}.`,
          phase: "sql",
          sql,
          type: "error",
        },
      ],
    ];
  }
  const recorded = rawRecordedFor(sql);
  return [
    done,
    [0, { detail: `Read only on ${label}`, phase: "run", type: "phase" }],
    [
      RUN_MS,
      {
        columns: recorded.columns,
        executionTimeMs: recorded.executionTimeMs,
        isTruncated: false,
        rowCount: recorded.rows.length,
        rows: recorded.rows,
        type: "result",
      },
    ],
    [
      0,
      {
        source: "inferred",
        spec: titled(recorded.spec, title ?? `Query on ${label}`),
        type: "card",
      },
    ],
    [0, { type: "done" }],
  ];
};

const isTerminal = (event: AskEvent): boolean =>
  event.type === "done" || event.type === "error";

interface AskEmulatorOptions {
  labelFor?: (connectionId: string) => string;
  onAnswered?: (params: AskParams, recorded: RecordedAsk) => void;
}

export const createAskEmulator = (
  emit: EmitAskEvent,
  { labelFor = () => "demo", onAnswered }: AskEmulatorOptions = {}
) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

  const clear = (askId: string): void => {
    for (const timer of timers.get(askId) ?? []) {
      clearTimeout(timer);
    }
    timers.delete(askId);
  };

  const play = (askId: string, steps: Step[], onCard?: () => void) => {
    let at = 0;
    const scheduled = steps.map(([delay, event]) => {
      at += delay;
      return setTimeout(() => {
        emit({ askId, event });
        if (event.type === "card") {
          onCard?.();
        }
        if (isTerminal(event)) {
          timers.delete(askId);
        }
      }, at);
    });
    timers.set(askId, scheduled);
  };

  return {
    ask: (params: AskParams): void =>
      play(
        params.askId,
        askScriptFor(params, labelFor(params.connectionId)),
        () => onAnswered?.(params, recordingOf(params))
      ),
    cancel: (askId: string): void => {
      if (!timers.has(askId)) {
        return;
      }
      clear(askId);
      emit({
        askId,
        event: {
          code: "CANCELLED",
          message: "The question was cancelled.",
          phase: "sql",
          type: "error",
        },
      });
    },
    runSql: (params: RunSqlParams): void =>
      play(params.askId, rawScriptFor(params, labelFor(params.connectionId))),
  };
};
