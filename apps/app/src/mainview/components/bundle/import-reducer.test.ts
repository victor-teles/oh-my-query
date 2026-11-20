import { describe, expect, it } from "vitest";

import { makeBundle, makeImportResult, makePlan } from "@/test/bundle-fixtures";

import type { ImportAction, ImportState, ReviewState } from "./import-reducer";

import {
  applyRequestOf,
  importCounts,
  importedTileCount,
  importReducer,
  INITIAL_IMPORT,
  isDuplicateHere,
  widgetChoice,
} from "./import-reducer";

const run = (state: ImportState, ...actions: ImportAction[]): ImportState => {
  let next = state;
  for (const action of actions) {
    next = importReducer(next, action);
  }
  return next;
};

const loaded = (): ReviewState => {
  const state = run(
    INITIAL_IMPORT,
    { source: "clipboard", type: "read" },
    { bundle: makeBundle(), plan: makePlan(), type: "loaded" }
  );
  if (state.phase !== "review") {
    throw new Error(`expected review, got ${state.phase}`);
  }
  return state;
};

describe("importReducer reading", () => {
  it("reads from a source, and a cancelled pick returns to the choice", () => {
    const reading = run(INITIAL_IMPORT, { source: "file", type: "read" });
    expect(reading).toStrictEqual({ phase: "reading", source: "file" });
    expect(run(reading, { type: "cancelled" })).toStrictEqual({
      phase: "choose",
    });
  });

  it("shows an invalid export and lets another source be read", () => {
    const invalid = run(
      INITIAL_IMPORT,
      { source: "clipboard", type: "read" },
      { message: "The clipboard has no Conch export.", type: "invalid" }
    );
    expect(invalid).toStrictEqual({
      message: "The clipboard has no Conch export.",
      phase: "invalid",
      source: "clipboard",
    });
    expect(run(invalid, { source: "file", type: "read" })).toMatchObject({
      phase: "reading",
      source: "file",
    });
  });

  it("ignores reads while a read is in flight and stray results at rest", () => {
    const reading = run(INITIAL_IMPORT, { source: "file", type: "read" });
    expect(run(reading, { source: "clipboard", type: "read" })).toBe(reading);
    expect(run(INITIAL_IMPORT, { type: "cancelled" })).toBe(INITIAL_IMPORT);
    expect(run(INITIAL_IMPORT, { type: "toggleBoards" })).toBe(INITIAL_IMPORT);
  });
});

describe("importReducer review", () => {
  it("maps suggested connections, leaves duplicates unchecked and boards on", () => {
    const review = loaded();
    expect(review.connectionMap).toStrictEqual({
      c1: "conn-analytics",
      c2: null,
    });
    expect(review.unchecked).toStrictEqual(["w2"]);
    expect(review.boards).toBeTruthy();
    expect(
      ["w1", "w2", "w3"].map((ref) => widgetChoice(review, ref))
    ).toStrictEqual(["on", "off", "unmapped"]);
    expect(isDuplicateHere(review, "w2")).toBeTruthy();
  });

  it("remaps a connection, which drops the duplicate tag", () => {
    const review = run(loaded(), {
      connectionId: "conn-staging",
      ref: "c1",
      type: "map",
    });
    expect(review).toMatchObject({ connectionMap: { c1: "conn-staging" } });
    expect(isDuplicateHere(review as ReviewState, "w2")).toBeFalsy();
  });

  it("toggles widgets but never an unmapped one", () => {
    const review = loaded();
    const toggled = run(
      review,
      { ref: "w2", type: "toggleWidget" },
      { ref: "w1", type: "toggleWidget" }
    );
    expect(toggled).toMatchObject({ unchecked: ["w1"] });
    expect(run(review, { ref: "w3", type: "toggleWidget" })).toBe(review);
  });

  it("toggles boards and one SQL block at a time", () => {
    const review = loaded();
    expect(run(review, { type: "toggleBoards" })).toMatchObject({
      boards: false,
    });
    const expanded = run(review, { ref: "w1", type: "toggleSql" });
    expect(expanded).toMatchObject({ expandedRef: "w1" });
    expect(run(expanded, { ref: "w2", type: "toggleSql" })).toMatchObject({
      expandedRef: "w2",
    });
    expect(run(expanded, { ref: "w1", type: "toggleSql" })).toMatchObject({
      expandedRef: null,
    });
  });

  it("counts what will import and builds the exact request", () => {
    const review = loaded();
    expect(importCounts(review)).toStrictEqual({ boards: 1, widgets: 1 });
    expect(importedTileCount(review, "b1")).toBe(1);
    expect(applyRequestOf(review)).toStrictEqual({
      boards: true,
      bundle: review.bundle,
      connectionMap: { c1: "conn-analytics", c2: null },
      skipWidgetRefs: ["w2"],
    });
    const none = run(review, {
      ref: "w1",
      type: "toggleWidget",
    }) as ReviewState;
    expect(importCounts(none)).toStrictEqual({ boards: 0, widgets: 0 });
  });
});

describe("importReducer importing", () => {
  it("imports, then shows the result", () => {
    const importing = run(loaded(), { type: "importing" });
    expect(importing.phase).toBe("importing");
    expect(run(importing, { ref: "w1", type: "toggleWidget" })).toBe(importing);
    const result = makeImportResult();
    expect(run(importing, { result, type: "imported" })).toStrictEqual({
      phase: "done",
      result,
    });
  });

  it("keeps the review after a failed import so it can be retried", () => {
    const failed = run(
      loaded(),
      { type: "importing" },
      { message: "Lost the connection.", type: "failed" }
    );
    expect(failed).toMatchObject({
      message: "Lost the connection.",
      phase: "error",
    });
    expect(run(failed, { type: "importing" }).phase).toBe("importing");
    expect(run(failed, { type: "toggleBoards" }).phase).toBe("review");
  });

  it("refuses to import when nothing is selected", () => {
    const empty = run(
      loaded(),
      { ref: "w1", type: "toggleWidget" },
      { type: "toggleBoards" }
    );
    expect(run(empty, { type: "importing" })).toBe(empty);
  });
});
