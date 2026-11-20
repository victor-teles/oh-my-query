import type { ImportCandidate } from "@oh-my-query/rpc";

import { buildBundle, planImport } from "@oh-my-query/rpc";

import type { Bundle, ImportPlan, ImportResult } from "@/lib/ipc";

import { makeConnection } from "./connection-fixture";
import { makeWidget } from "./widget-fixtures";

export const BUNDLE_CONNECTIONS = [
  { id: "src-analytics", name: "analytics", type: "postgresql" },
  { id: "src-warehouse", name: "warehouse", type: "clickhouse" },
];

export const LOCAL_CONNECTIONS = [
  makeConnection({ id: "conn-analytics", name: "analytics" }),
  makeConnection({ color: "denim", id: "conn-staging", name: "staging" }),
  makeConnection({
    database: "/data/shop.db",
    id: "conn-shop",
    name: "shop",
    type: "sqlite",
  }),
];

const sourceWidgets = () => [
  makeWidget({ connectionId: "src-analytics", id: "w-revenue" }),
  makeWidget({
    connectionId: "src-analytics",
    id: "w-signups",
    name: "Weekly signups",
    params: [],
    sqlTemplate:
      "select date_trunc('week', created_at) as week, count(*) from users group by 1",
    view: "table",
  }),
  makeWidget({
    connectionId: "src-warehouse",
    dialect: "clickhouse",
    id: "w-clicks",
    name: "Clicks today",
    params: [],
    sqlTemplate: "select count() from clicks where day = today()",
    view: "kpi",
  }),
];

export const makeBundle = (): Bundle =>
  buildBundle({
    boards: [
      {
        createdAt: "2026-11-19T08:00:00.000Z",
        emoji: "📈",
        id: "b-weekly",
        name: "Weekly review",
        refresh: "off",
        sharedValues: {},
        tiles: [
          { id: "t1", size: "l", widgetId: "w-revenue" },
          { id: "t2", size: "m", widgetId: "w-signups" },
          { id: "t3", size: "s", widgetId: "w-clicks" },
        ],
        updatedAt: "2026-11-19T08:00:00.000Z",
      },
    ],
    connections: BUNDLE_CONNECTIONS,
    now: new Date("2026-11-20T09:00:00.000Z"),
    widgets: sourceWidgets(),
  });

export const existingSignups = () =>
  makeWidget({
    connectionId: "conn-analytics",
    id: "w-here",
    name: "Weekly signups",
    params: [],
    sqlTemplate: `select date_trunc('week', created_at) as week,
      count(*) from users group by 1`,
  });

export const makePlan = (
  bundle: Bundle = makeBundle(),
  existing = [existingSignups()],
  local: readonly ImportCandidate[] = LOCAL_CONNECTIONS
): ImportPlan => planImport(bundle, local, existing);

export const makeImportResult = (
  overrides: Partial<ImportResult> = {}
): ImportResult => ({
  boards: 1,
  failed: [],
  importedWidgetIds: ["new-revenue"],
  skipped: [],
  widgets: 1,
  ...overrides,
});
