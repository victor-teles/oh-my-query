import { describe, expect, it } from "vitest";

import { runResult } from "@/test/widget-fixtures";

import { initialWidgetRun, widgetRunReducer } from "./widget-run-reducer";

const started = widgetRunReducer(initialWidgetRun({ region: "Europe" }), {
  runId: "r1",
  type: "start",
  values: { region: "Asia Pacific" },
});

describe("widgetRunReducer", () => {
  it("starts a run with the requested values", () => {
    expect(started).toMatchObject({
      runId: "r1",
      status: "running",
      values: { region: "Asia Pacific" },
    });
  });

  it("stores the outcome of the current run and counts it", () => {
    const outcome = runResult({ region: "Asia Pacific" });
    const done = widgetRunReducer(started, {
      outcome,
      runId: "r1",
      type: "success",
    });
    expect(done).toMatchObject({ completedRuns: 1, outcome, status: "done" });
  });

  it("ignores an outcome from a superseded run", () => {
    const next = widgetRunReducer(started, {
      runId: "r2",
      type: "start",
      values: {},
    });
    expect(
      widgetRunReducer(next, {
        outcome: runResult(),
        runId: "r1",
        type: "success",
      })
    ).toBe(next);
    expect(
      widgetRunReducer(next, {
        failure: { code: "X", message: "x" },
        runId: "r1",
        type: "failure",
      })
    ).toBe(next);
  });

  it("keeps the previous outcome while a new run is in flight", () => {
    const done = widgetRunReducer(started, {
      outcome: runResult(),
      runId: "r1",
      type: "success",
    });
    const rerun = widgetRunReducer(done, {
      runId: "r2",
      type: "start",
      values: {},
    });
    expect(rerun.outcome).toBe(done.outcome);
    expect(rerun.status).toBe("running");
  });

  it("records a failure", () => {
    expect(
      widgetRunReducer(started, {
        failure: { code: "QUERY_FAILED", message: "boom" },
        runId: "r1",
        type: "failure",
      })
    ).toMatchObject({ failure: { message: "boom" }, status: "error" });
  });

  it("returns to the last outcome or idle when cancelled", () => {
    expect(widgetRunReducer(started, { type: "cancel" }).status).toBe("idle");
    const done = widgetRunReducer(started, {
      outcome: runResult(),
      runId: "r1",
      type: "success",
    });
    expect(widgetRunReducer(done, { type: "cancel" })).toBe(done);
    const rerun = widgetRunReducer(done, {
      runId: "r2",
      type: "start",
      values: {},
    });
    expect(widgetRunReducer(rerun, { type: "cancel" }).status).toBe("done");
  });
});
