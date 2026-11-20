import type { ColumnInfo, QueryLanguage } from "@oh-my-query/core/client";
import type { CardSpec } from "@oh-my-query/rpc";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";

export interface RecordedAsk {
  sql: string;
  columns: ColumnInfo[];
  rows: unknown[][];
  executionTimeMs: number;
  spec: CardSpec;
  language?: QueryLanguage;
}

export const MONTHS = [
  "2026-01-01",
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
  "2026-09-01",
];

export const REGION_MRR: [string, number[]][] = [
  ["North America", [180, 186, 195, 203, 214, 222, 234, 246, 258]],
  ["Europe", [97, 101, 106, 110, 117, 123, 131, 139, 146]],
  ["Asia Pacific", [31, 34, 38, 42, 47, 52, 58, 64, 71]],
];

export const REVENUE_BY_REGION: RecordedAsk = {
  columns: [
    { name: "month", typeName: "DATE" },
    { name: "region", typeName: "TEXT" },
    { name: "mrr", typeName: "NUMERIC" },
  ],
  executionTimeMs: 386,
  rows: MONTHS.flatMap((month, index) =>
    REGION_MRR.map(([region, values]) => [
      month,
      region,
      String((values[index] ?? 0) * 1000),
    ])
  ),
  spec: {
    formats: {
      month: { kind: "month" },
      mrr: { currency: "USD", kind: "currency" },
    },
    insight:
      "Asia Pacific more than doubled this year, from $31k to $71k. Total MRR reached $475k in September, up 54% since January.",
    subtitle: "Jan to Sep 2026 · $475k in September",
    title: "Monthly recurring revenue by region",
    version: CARD_SPEC_VERSION,
    view: {
      groupBy: "region",
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    },
  },
  sql: `-- Monthly recurring revenue by region in 2026
select date_trunc('month', s.billed_at)::date as month,
       r.name as region,
       sum(s.amount_cents) / 100.0 as mrr
from subscriptions s
join accounts a on a.id = s.account_id
join regions r on r.id = a.region_id
where s.billed_at >= date '2026-01-01'
  and s.status = 'active'
group by 1, 2
order by 1, 2
limit 500`,
};

const WEEKS = [
  "2026-07-06",
  "2026-07-13",
  "2026-07-20",
  "2026-07-27",
  "2026-08-03",
  "2026-08-10",
  "2026-08-17",
  "2026-08-24",
];
const PLANS: [string, number[]][] = [
  ["Free", [412, 398, 445, 431, 468, 502, 489, 534]],
  ["Starter", [126, 131, 128, 142, 151, 149, 163, 171]],
  ["Pro", [64, 71, 69, 77, 82, 88, 91, 97]],
  ["Team", [18, 21, 19, 24, 26, 25, 29, 33]],
];

export const WEEKLY_SIGNUPS: RecordedAsk = {
  columns: [
    { name: "week", typeName: "DATE" },
    { name: "free", typeName: "INT8" },
    { name: "starter", typeName: "INT8" },
    { name: "pro", typeName: "INT8" },
    { name: "team", typeName: "INT8" },
  ],
  executionTimeMs: 212,
  rows: WEEKS.map((week, index) => [
    week,
    ...PLANS.map(([, values]) => String(values[index] ?? 0)),
  ]),
  spec: {
    formats: {
      free: { kind: "integer" },
      pro: { kind: "integer" },
      starter: { kind: "integer" },
      team: { kind: "integer" },
      week: { kind: "date" },
    },
    insight:
      "Signups grew from 620 to 835 a week over the last two months. Pro and Team grew fastest.",
    subtitle: "Last 8 weeks · 835 in the week of Aug 24",
    title: "Weekly signups by plan",
    version: CARD_SPEC_VERSION,
    view: {
      kind: "chart",
      mark: "bar",
      stacked: true,
      x: "week",
      y: ["free", "starter", "pro", "team"],
    },
  },
  sql: `-- Weekly signups by plan over the last 8 weeks
select date_trunc('week', u.created_at)::date as week,
       count(*) filter (where p.code = 'free') as free,
       count(*) filter (where p.code = 'starter') as starter,
       count(*) filter (where p.code = 'pro') as pro,
       count(*) filter (where p.code = 'team') as team
from users u
join plans p on p.id = u.plan_id
where u.created_at >= current_date - interval '8 weeks'
group by 1
order by 1`,
};

export const regionRevenue = (region: string, months = MONTHS) => {
  const values = REGION_MRR.find(([name]) => name === region)?.[1] ?? [];
  return months.flatMap((month) => {
    const index = MONTHS.indexOf(month);
    const value = values[index];
    return value === undefined ? [] : [[month, String(value * 1000)]];
  });
};

export const REGION_REVENUE: RecordedAsk = {
  columns: [
    { name: "month", typeName: "DATE" },
    { name: "mrr", typeName: "NUMERIC" },
  ],
  executionTimeMs: 214,
  rows: regionRevenue("Europe"),
  spec: {
    formats: {
      month: { kind: "month" },
      mrr: { currency: "USD", kind: "currency" },
    },
    insight: "Europe grew every month this year, from $97k to $146k.",
    subtitle: "Jan to Sep 2026 · $146k in September",
    title: "Monthly recurring revenue in Europe",
    version: CARD_SPEC_VERSION,
    view: {
      kind: "chart",
      mark: "line",
      stacked: false,
      x: "month",
      y: ["mrr"],
    },
  },
  sql: `-- Monthly recurring revenue in Europe
select date_trunc('month', s.billed_at)::date as month,
       sum(s.amount_cents) / 100.0 as mrr
from subscriptions s
join accounts a on a.id = s.account_id
join regions r on r.id = a.region_id
where r.name = 'Europe'
  and s.billed_at >= date '2026-01-01'
  and s.billed_at < date '2026-10-01'
group by 1
order by 1`,
};

const QUARTERS = ["2026-01-01", "2026-04-01", "2026-07-01"];

const quarterTotal = (values: number[], quarter: number): number =>
  values
    .slice(quarter * 3, quarter * 3 + 3)
    .reduce((sum, value) => sum + value, 0);

export const QUARTERLY_REVENUE: RecordedAsk = {
  columns: [
    { name: "quarter", typeName: "DATE" },
    { name: "region", typeName: "TEXT" },
    { name: "mrr", typeName: "NUMERIC" },
  ],
  executionTimeMs: 402,
  rows: QUARTERS.flatMap((quarter, index) =>
    REGION_MRR.map(([region, values]) => [
      quarter,
      region,
      String(quarterTotal(values, index) * 1000),
    ])
  ),
  spec: {
    formats: {
      mrr: { currency: "USD", kind: "currency" },
      quarter: { kind: "date" },
    },
    insight:
      "Every region grew each quarter. Asia Pacific grew fastest, from $103k to $193k.",
    subtitle: "Q1 to Q3 2026 · $1.3M in Q3",
    title: "Quarterly recurring revenue by region",
    version: CARD_SPEC_VERSION,
    view: {
      groupBy: "region",
      kind: "chart",
      mark: "bar",
      stacked: false,
      x: "quarter",
      y: ["mrr"],
    },
  },
  sql: `-- Quarterly recurring revenue by region in 2026
select date_trunc('quarter', s.billed_at)::date as quarter,
       r.name as region,
       sum(s.amount_cents) / 100.0 as mrr
from subscriptions s
join accounts a on a.id = s.account_id
join regions r on r.id = a.region_id
where s.billed_at >= date '2026-01-01'
  and s.status = 'active'
group by 1, 2
order by 1, 2
limit 500`,
};
