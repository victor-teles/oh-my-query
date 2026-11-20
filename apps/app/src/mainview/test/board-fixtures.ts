import type { Board, BoardTile, ParamDef, Widget } from "@/lib/ipc";

import { makeWidget } from "./widget-fixtures";

export const PERIOD: ParamDef = {
  default: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
};

const REGION: ParamDef = {
  default: "Europe",
  label: "Region",
  name: "region",
  options: ["Asia Pacific", "Europe", "North America"],
  type: "select",
};

export const boardWidgets = (): Widget[] => [
  makeWidget({
    id: "w-revenue",
    name: "Revenue by region",
    params: [REGION, PERIOD],
  }),
  makeWidget({
    id: "w-signups",
    name: "Signups",
    params: [PERIOD],
    view: "table",
  }),
  makeWidget({ id: "w-churn", name: "Churn", params: [REGION], view: "table" }),
  makeWidget({ id: "w-mrr", name: "MRR", params: [], view: "table" }),
  makeWidget({ id: "w-orders", name: "Orders", params: [], view: "table" }),
];

export const makeTiles = (widgetIds: readonly string[]): BoardTile[] =>
  widgetIds.map((widgetId, index) => ({
    id: `t${index + 1}`,
    size: index === 0 ? "l" : "m",
    widgetId,
  }));

export const makeBoard = (overrides: Partial<Board> = {}): Board => ({
  createdAt: "2026-11-19T08:00:00.000Z",
  id: "b-ops",
  name: "Ops",
  refresh: "off",
  sharedValues: {},
  tiles: makeTiles(["w-revenue", "w-signups", "w-churn", "w-mrr"]),
  updatedAt: "2026-11-19T08:00:00.000Z",
  ...overrides,
});
