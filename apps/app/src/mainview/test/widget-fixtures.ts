import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";

import type { RecentAsk, Widget, WidgetRunResult } from "@/lib/ipc";

export const REGION_SQL = `select date_trunc('month', billed_at)::date as month, sum(mrr) as mrr
from revenue
where region = {{region}}
  and billed_at >= {{period.from}}::date and billed_at < {{period.to}}::date
group by 1 order by 1`;

export const makeWidget = (overrides: Partial<Widget> = {}): Widget => ({
  connectionId: "analytics",
  createdAt: "2026-11-01T00:00:00.000Z",
  database: null,
  dialect: "postgresql",
  id: "w-revenue",
  lastRunAt: null,
  lastValues: {},
  name: "Revenue by region",
  params: [
    {
      default: "Europe",
      label: "Region",
      name: "region",
      options: ["Asia Pacific", "Europe", "North America"],
      type: "select",
    },
    {
      default: "lastQuarter",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
  ],
  prompt: "revenue by region",
  spec: {
    formats: {
      month: { kind: "month" },
      mrr: { currency: "USD", kind: "currency" },
    },
    insight: "Europe grew every month.",
    subtitle: "Jan to Sep 2026",
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
  sqlTemplate: REGION_SQL,
  updatedAt: "2026-11-01T00:00:00.000Z",
  view: "line",
  ...overrides,
});

export const makeRecent = (overrides: Partial<RecentAsk> = {}): RecentAsk => ({
  askedAt: "2026-11-18T09:00:00.000Z",
  connectionId: "analytics",
  database: null,
  dialect: "postgresql",
  id: "ask-1",
  prompt: "Revenue for Europe",
  spec: makeWidget().spec,
  sql: "select 1",
  ...overrides,
});

const MONTHS = ["2026-07-01", "2026-08-01", "2026-09-01"];

const DEFAULT_VALUES: WidgetRunResult["values"] = {
  period: "lastQuarter",
  region: "Europe",
};

export const runResult = (
  values: WidgetRunResult["values"] = DEFAULT_VALUES,
  mrr: number[] = [110, 117, 123]
): WidgetRunResult => ({
  compiledSql: "select … where region = $1",
  result: {
    columns: [
      { name: "month", typeName: "DATE" },
      { name: "mrr", typeName: "NUMERIC" },
    ],
    executionTimeMs: 386,
    isTruncated: false,
    resultType: "tabular",
    rowCount: MONTHS.length,
    rows: MONTHS.map((month, index) => [
      month,
      String((mrr[index] ?? 0) * 1000),
    ]),
  },
  values,
});
