import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";
import { makeRecent } from "@/test/widget-fixtures";

import type { HistoryTarget } from "./history-actions";

import { historyActions, historyTarget } from "./history-actions";

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const warehouse = makeConnection({ id: "warehouse", name: "warehouse" });
const ask = makeRecent({ connectionId: "analytics", database: "sales" });

const disabledIds = (target: HistoryTarget | null) =>
  historyActions(target)
    .filter((action) => action.disabled)
    .map((action) => action.id);

describe("history target", () => {
  it("asks on the stored connection and database", () => {
    expect(historyTarget(ask, [analytics, warehouse], warehouse)).toStrictEqual(
      {
        fallback: null,
        target: { connectionId: "analytics", database: "sales" },
      }
    );
  });

  it("falls back to the active connection when the stored one is gone", () => {
    expect(historyTarget(ask, [warehouse], warehouse)).toStrictEqual({
      fallback: warehouse,
      target: { connectionId: "warehouse", database: null },
    });
  });

  it("has nowhere to ask without any connection", () => {
    expect(historyTarget(ask, [], null)).toBeNull();
  });
});

describe("history actions", () => {
  it("offers every action on the stored connection", () => {
    expect(
      historyActions(historyTarget(ask, [analytics], null)).map((action) => [
        action.id,
        action.tone,
      ])
    ).toStrictEqual([
      ["ask-again", "default"],
      ["run-sql", "default"],
      ["copy-sql", "default"],
      ["copy-prompt", "default"],
      ["save-widget", "default"],
      ["remove", "destructive"],
      ["clear", "destructive"],
    ]);
    expect(disabledIds(historyTarget(ask, [analytics], null))).toStrictEqual(
      []
    );
  });

  it("runs stored SQL only where it was written", () => {
    expect(
      disabledIds(historyTarget(ask, [warehouse], warehouse))
    ).toStrictEqual(["run-sql"]);
  });

  it("disables asking and running without a connection", () => {
    expect(disabledIds(null)).toStrictEqual(["ask-again", "run-sql"]);
  });

  it("shows the shortcuts the view handles", () => {
    const keys = Object.fromEntries(
      historyActions(null).map((action) => [action.id, action.keys])
    );
    expect(keys).toMatchObject({
      "ask-again": ["↩"],
      "copy-sql": ["⌘", "C"],
      remove: ["⌃", "X"],
      "save-widget": ["⌘", "S"],
    });
  });
});
