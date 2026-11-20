import { describe, expect, it } from "vitest";

import {
  askStateAfter,
  refineStateAfter,
  REFUSED,
  REVENUE,
} from "@/test/ask-fixtures";

import { askFooterHints } from "./ask-footer-hints";
import {
  askActionLabel,
  askAnnouncement,
  headerSegments,
  indicatorFor,
  sqlHeading,
  statusLabel,
} from "./ask-labels";
import { initialAskState } from "./ask-reducer";

describe("headerSegments", () => {
  it("shows the connection while writing, the line count once written, and rows with time after the result", () => {
    expect(
      headerSegments(
        askStateAfter(REVENUE, { type: "sqlDelta" }),
        "PostgreSQL",
        "analytics"
      )
    ).toStrictEqual(["PostgreSQL", "analytics"]);
    expect(
      headerSegments(
        askStateAfter(REVENUE, { type: "sqlDone" }),
        "PostgreSQL",
        "analytics"
      )
    ).toStrictEqual(["PostgreSQL", "12 lines"]);
    expect(
      headerSegments(askStateAfter(REVENUE), "PostgreSQL", "analytics")
    ).toStrictEqual(["PostgreSQL", "27 rows", "386ms"]);
  });

  it.each([
    [{ nth: 3, type: "sqlDelta" as const }, ["Writing SQL", "1 line"]],
    [{ nth: 3, type: "phase" as const }, ["Running", "read only"]],
    [{ nth: 4, type: "phase" as const }, ["Shaping", "9 rows"]],
    [undefined, ["9 rows", "214ms"]],
  ])("narrates a refine after %j", (stopAfter, segments) => {
    const state = refineStateAfter(
      askStateAfter(REVENUE),
      "only Europe",
      stopAfter
    );
    expect(headerSegments(state, "PostgreSQL", "analytics")).toStrictEqual([
      "PostgreSQL",
      ...segments,
    ]);
  });
});

describe("askAnnouncement", () => {
  const refined = refineStateAfter(askStateAfter(REVENUE), "only Europe");

  it("announces a refined card and a step, and nothing while working", () => {
    expect(askAnnouncement(refined)).toBe(
      "Updated: Monthly recurring revenue in Europe"
    );
    expect(
      askAnnouncement({ ...refined, position: 0, transition: "step" })
    ).toBe(`Step 1 of 2: ${REVENUE}`);
    expect(askAnnouncement(askStateAfter(REVENUE))).toBe("");
    expect(
      askAnnouncement(
        refineStateAfter(refined, "by quarter", { type: "sqlDelta" })
      )
    ).toBe("");
  });
});

describe("indicatorFor", () => {
  it("maps working, done, error and idle", () => {
    expect(indicatorFor(askStateAfter(REVENUE, { type: "sqlDelta" }))).toBe(
      "busy"
    );
    expect(indicatorFor(askStateAfter(REVENUE))).toBe("success");
    expect(indicatorFor(askStateAfter(REFUSED))).toBe("error");
    expect(indicatorFor(initialAskState)).toBe("idle");
  });
});

describe("statusLabel", () => {
  it("labels each phase factually", () => {
    expect(
      statusLabel(askStateAfter(REVENUE, { type: "sqlDelta" }), "analytics")
    ).toStrictEqual({
      primary: "Writing SQL",
      secondary: "Reading the analytics schema",
    });
    expect(
      statusLabel(
        askStateAfter(REVENUE, { nth: 3, type: "phase" }),
        "analytics"
      )
    ).toStrictEqual({
      primary: "Running query",
      secondary: "Read only on analytics",
    });
    expect(
      statusLabel(
        askStateAfter(REVENUE, { nth: 4, type: "phase" }),
        "analytics"
      )
    ).toStrictEqual({
      primary: "Shaping the result",
      secondary: "27 rows",
    });
  });

  it("counts repair attempts and says stopped after a cancel", () => {
    const repairing = {
      ...askStateAfter(REVENUE, { type: "sqlDelta" }),
      repairReason: "column x does not exist",
      repairs: 1,
    };
    expect(statusLabel(repairing, "analytics")).toStrictEqual({
      primary: "Fixing the query · attempt 2",
      secondary: "column x does not exist",
    });
    expect(
      statusLabel({ ...repairing, status: "cancelled" }, "analytics")
    ).toStrictEqual({
      primary: "Stopped",
      secondary: null,
    });
  });

  it("falls back to the connection name before the schema detail arrives", () => {
    expect(
      statusLabel({ ...initialAskState, status: "schema" }, "billing").secondary
    ).toBe("Reading the billing schema");
  });
});

describe("askFooterHints", () => {
  const labels = (busy: boolean, canSave: boolean, hasSql: boolean) =>
    askFooterHints({
      busy,
      canSave,
      chain: null,
      hasSql,
      reporting: false,
    }).map((hint) => hint.label);

  it("offers stop while busy, and actions, save, copy and SQL once answered", () => {
    expect(labels(true, true, true)).toStrictEqual(["Stop"]);
    expect(labels(false, false, false)).toStrictEqual(["Copy SQL", "SQL"]);
    expect(labels(false, false, true)).toStrictEqual([
      "Actions",
      "Copy SQL",
      "SQL",
    ]);
    expect(labels(false, true, true)).toStrictEqual([
      "Actions",
      "Save",
      "Copy SQL",
      "SQL",
    ]);
  });

  it("keeps only Actions while a result message needs the room", () => {
    expect(
      askFooterHints({
        busy: false,
        canSave: true,
        chain: null,
        hasSql: true,
        reporting: true,
      }).map((hint) => hint.label)
    ).toStrictEqual(["Actions"]);
  });

  it.each([
    [1, ["New question", "Actions", "Save"]],
    [3, ["New question", "Steps", "Actions", "Save"]],
  ])("offers the chain keys for a %i-turn chain", (turns, labels) => {
    expect(
      askFooterHints({
        busy: false,
        canSave: true,
        chain: { turns },
        hasSql: true,
        reporting: false,
      }).map((hint) => hint.label)
    ).toStrictEqual(labels);
  });
});

describe("source labels", () => {
  it("names the SQL by where it came from", () => {
    expect(sqlHeading("question")).toBe("Generated SQL");
    expect(sqlHeading("sql")).toBe("Your SQL");
    expect(sqlHeading("match")).toBe("Matching rows");
  });

  it.each([
    ["question", false, "Ask"],
    ["question", true, "Ask again"],
    ["sql", false, "Run"],
    ["sql", true, "Run again"],
    ["match", true, "Ask"],
  ] as const)("labels a %s submit (repeat: %s) %s", (source, repeat, label) => {
    expect(askActionLabel(source, repeat)).toBe(label);
  });
});
