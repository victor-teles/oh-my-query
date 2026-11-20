import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";

import type { RecordedAsk } from "@/lib/browser-ask-recordings";

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

export const MONGO_ORDERS_BY_STATUS: RecordedAsk = {
  columns: [
    { name: "status", typeName: "TEXT" },
    { name: "orders", typeName: "NUMERIC" },
  ],
  executionTimeMs: 48,
  language: "mongodb",
  rows: [
    ["paid", 8412],
    ["pending", 1236],
    ["refunded", 318],
    ["cancelled", 154],
  ],
  spec: {
    formats: { orders: { kind: "integer" } },
    insight: "Paid orders make up 83% of the 10,120 orders this year.",
    subtitle: "2026 so far · 10,120 orders",
    title: "Orders by status",
    version: CARD_SPEC_VERSION,
    view: {
      kind: "chart",
      mark: "bar",
      stacked: false,
      x: "status",
      y: ["orders"],
    },
  },
  sql: pretty({
    collection: "orders",
    description: "Orders by status in 2026",
    pipeline: [
      { $match: { created_at: { $gte: { $date: "2026-01-01T00:00:00Z" } } } },
      { $group: { _id: "$status", orders: { $sum: 1 } } },
      { $sort: { orders: -1 } },
      { $project: { _id: 0, orders: 1, status: "$_id" } },
    ],
  }),
};

export const REDIS_KEYS_BY_PATTERN: RecordedAsk = {
  columns: [
    { name: "group", typeName: "TEXT" },
    { name: "keys", typeName: "NUMERIC" },
  ],
  executionTimeMs: 31,
  language: "redis",
  rows: [
    ["session:*", 3412],
    ["rate:*", 1180],
    ["user:*:cart", 642],
    ["leaderboard:*", 4],
  ],
  spec: {
    formats: { keys: { kind: "integer" } },
    insight: "Sessions hold 65% of the 5,238 keys.",
    subtitle: "5,238 keys in db 0",
    title: "Keys by pattern",
    version: CARD_SPEC_VERSION,
    view: {
      kind: "chart",
      mark: "bar",
      stacked: false,
      x: "group",
      y: ["keys"],
    },
  },
  sql: pretty({
    description: "Keys by pattern",
    groupBy: "pattern",
    kind: "scan",
    limit: 20,
    match: "*",
    measure: "count",
  }),
};

export const REDIS_LEADERBOARD: RecordedAsk = {
  columns: [
    { name: "member", typeName: "TEXT" },
    { name: "score", typeName: "NUMERIC" },
  ],
  executionTimeMs: 4,
  language: "redis",
  rows: [
    ["alice", 3120],
    ["bruno", 2984],
    ["chen", 2710],
    ["dara", 2655],
    ["emeka", 2401],
    ["farah", 2290],
    ["gus", 2104],
    ["hana", 1987],
    ["ines", 1876],
    ["jonas", 1702],
  ],
  spec: {
    formats: { score: { kind: "integer" } },
    title: "Top 10 on the leaderboard",
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  sql: pretty({
    commands: [["ZREVRANGE", "leaderboard:weekly", "0", "9", "WITHSCORES"]],
    description: "Top 10 on the weekly leaderboard",
    kind: "commands",
  }),
};

export interface RecordedRefusal {
  sql: string;
  message: string;
}

export const MONGO_REFUSAL: RecordedRefusal = {
  message: "$merge writes data; only read-only pipelines can run here.",
  sql: pretty({
    collection: "orders",
    description: "Copy orders into an archive",
    pipeline: [{ $match: {} }, { $merge: { into: "orders_archive" } }],
  }),
};

export const REDIS_REFUSAL: RecordedRefusal = {
  message: "SET writes data; only read commands can run here.",
  sql: pretty({
    commands: [["SET", "feature:checkout", "off"]],
    description: "Turn off the checkout flag",
    kind: "commands",
  }),
};
