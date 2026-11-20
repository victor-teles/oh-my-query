import { describe, expect, it } from "vitest";

import type { ResultAction } from "./result-actions";

import {
  askResultActions,
  canCopyChart,
  exportActions,
} from "./result-actions";

const ids = (actions: readonly ResultAction[]) =>
  actions.map((action) => action.id);
const enabled = (actions: readonly ResultAction[]) =>
  actions.filter((action) => !action.disabled).map((action) => action.id);

const answered = { hasRows: true, hasSql: true, view: "bar" } as const;

describe("exportActions", () => {
  it("lists copy and save actions in order, with the chart for chart views", () => {
    expect(ids(exportActions(answered))).toStrictEqual([
      "copy-sql",
      "copy-csv",
      "copy-tsv",
      "copy-markdown",
      "copy-png",
      "save-csv",
    ]);
  });

  it.each(["kpi", "table", null] as const)(
    "leaves out the chart on a %s view",
    (view) => {
      expect(ids(exportActions({ ...answered, view }))).not.toContain(
        "copy-png"
      );
    }
  );

  it("disables data actions when there are no rows", () => {
    expect(
      enabled(exportActions({ hasRows: false, hasSql: true, view: null }))
    ).toStrictEqual(["copy-sql"]);
  });

  it("shows ⌘C on Copy SQL", () => {
    expect(exportActions(answered)[0]?.keys).toStrictEqual(["⌘", "C"]);
  });
});

describe("askResultActions", () => {
  it("appends Save as Widget and Add to Board", () => {
    const actions = askResultActions({ ...answered, canSave: true });
    expect(ids(actions).slice(-2)).toStrictEqual([
      "save-widget",
      "add-to-board",
    ]);
    expect(actions.at(-2)?.keys).toStrictEqual(["⌘", "S"]);
  });

  it("disables saving when the answer can't be saved", () => {
    const actions = askResultActions({
      canSave: false,
      hasRows: false,
      hasSql: true,
      view: null,
    });
    expect(enabled(actions)).toStrictEqual(["copy-sql"]);
  });
});

describe("canCopyChart", () => {
  it.each([
    ["bar", true],
    ["line", true],
    ["area", true],
    ["pie", true],
    ["kpi", false],
    ["table", false],
    [null, false],
  ] as const)("is %s → %s", (view, expected) => {
    expect(canCopyChart(view)).toBe(expected);
  });
});
