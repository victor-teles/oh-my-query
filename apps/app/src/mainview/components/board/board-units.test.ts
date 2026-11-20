import { describe, expect, it } from "vitest";

import { runResult } from "@/test/widget-fixtures";

import { spanFor } from "./board-grid";
import { boardRunsReducer } from "./board-runs";
import { nextSize, sizeOfAction, tileActions } from "./tile-actions";
import { nearestSlot, previewOrder, projectPoint } from "./use-tile-drag";

describe("spanFor", () => {
  it("maps sizes to 3/4/6/12 columns on a wide board", () => {
    expect(
      ["s", "m", "l", "wide"].map((size) => spanFor(size as "s", 1200))
    ).toStrictEqual([3, 4, 6, 12]);
  });

  it("collapses to half width below 900px and full width below 600px", () => {
    expect(spanFor("s", 800)).toBe(6);
    expect(spanFor("wide", 800)).toBe(12);
    expect(spanFor("m", 500)).toBe(12);
  });

  it("uses the configured span before the board is measured", () => {
    expect(spanFor("m", 0)).toBe(4);
  });
});

describe("boardRunsReducer", () => {
  it("tracks runs per tile and prunes removed tiles", () => {
    const started = boardRunsReducer(
      {},
      {
        action: { runId: "r1", type: "start", values: {} },
        tileId: "t1",
        type: "tile",
      }
    );
    const done = boardRunsReducer(started, {
      action: { outcome: runResult(), runId: "r1", type: "success" },
      tileId: "t1",
      type: "tile",
    });
    expect(done.t1?.status).toBe("done");
    expect(boardRunsReducer(done, { keep: ["t1"], type: "prune" })).toBe(done);
    expect(boardRunsReducer(done, { keep: [], type: "prune" })).toStrictEqual(
      {}
    );
  });

  it("returns the same state for a stale result", () => {
    const started = boardRunsReducer(
      {},
      {
        action: { runId: "r1", type: "start", values: {} },
        tileId: "t1",
        type: "tile",
      }
    );
    expect(
      boardRunsReducer(started, {
        action: { outcome: runResult(), runId: "old", type: "success" },
        tileId: "t1",
        type: "tile",
      })
    ).toBe(started);
  });
});

describe("tile actions", () => {
  it("disables the current size and Copy SQL before a result", () => {
    const actions = tileActions("m", false);
    expect(
      actions.find((action) => action.id === "size-m")?.disabled
    ).toBeTruthy();
    expect(
      actions.find((action) => action.id === "copy-sql")?.disabled
    ).toBeTruthy();
    expect(actions.at(-1)?.tone).toBe("destructive");
  });

  it("reads sizes from actions and cycles sizes", () => {
    expect(sizeOfAction("size-wide")).toBe("wide");
    expect(sizeOfAction("remove")).toBeNull();
    expect(nextSize("l")).toBe("wide");
    expect(nextSize("wide")).toBe("s");
  });
});

describe("drag helpers", () => {
  it("projects a flick with the 0.998 deceleration", () => {
    const projected = projectPoint({ x: 100, y: 50 }, { x: 1000, y: 0 });
    expect(projected.x).toBeCloseTo(599, 6);
    expect(projected.y).toBe(50);
  });

  it("finds the nearest slot", () => {
    const slots = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 0, y: 300 },
    ];
    expect(nearestSlot(slots, { x: 260, y: 40 })).toBe(1);
    expect(nearestSlot(slots, { x: 20, y: 400 })).toBe(2);
  });

  it("previews the dragged item at its target slot", () => {
    expect(
      previewOrder(["a", "b", "c"], { from: 0, over: 2, tileId: "a" })
    ).toStrictEqual(["b", "c", "a"]);
    expect(previewOrder(["a", "b"], null)).toStrictEqual(["a", "b"]);
    expect(
      previewOrder(["a", "b"], { from: 5, over: 0, tileId: "x" })
    ).toStrictEqual(["a", "b"]);
  });
});
