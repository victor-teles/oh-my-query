import { describe, expect, it } from "vitest";

import {
  initialStackState,
  launcherStackReducer,
  ROOT_VIEW,
} from "./use-launcher-stack";

const SETTINGS = { kind: "settings" } as const;

describe("launcherStackReducer", () => {
  it("pushes a view and moves forward", () => {
    const next = launcherStackReducer(initialStackState, {
      type: "push",
      view: SETTINGS,
    });
    expect(next.stack).toStrictEqual([ROOT_VIEW, SETTINGS]);
    expect(next.direction).toBe(1);
  });

  it("ignores pushing the view that is already on top", () => {
    const pushed = launcherStackReducer(initialStackState, {
      type: "push",
      view: SETTINGS,
    });
    expect(launcherStackReducer(pushed, { type: "push", view: SETTINGS })).toBe(
      pushed
    );
  });

  it("pops back toward root and moves backward", () => {
    const pushed = launcherStackReducer(initialStackState, {
      type: "push",
      view: SETTINGS,
    });
    const popped = launcherStackReducer(pushed, { type: "pop" });
    expect(popped.stack).toStrictEqual([ROOT_VIEW]);
    expect(popped.direction).toBe(-1);
  });

  it("returns from an answer asked again to History", () => {
    const history = { kind: "history" } as const;
    const ask = { kind: "ask" } as const;
    const onHistory = launcherStackReducer(initialStackState, {
      type: "push",
      view: history,
    });
    const asked = launcherStackReducer(onHistory, { type: "push", view: ask });
    expect(asked.stack).toStrictEqual([ROOT_VIEW, history, ask]);
    expect(launcherStackReducer(asked, { type: "pop" }).stack).toStrictEqual([
      ROOT_VIEW,
      history,
    ]);
  });

  it("never pops the root view", () => {
    expect(launcherStackReducer(initialStackState, { type: "pop" })).toBe(
      initialStackState
    );
  });

  it("resets to root", () => {
    const pushed = launcherStackReducer(initialStackState, {
      type: "push",
      view: SETTINGS,
    });
    expect(launcherStackReducer(pushed, { type: "reset" }).stack).toStrictEqual(
      [ROOT_VIEW]
    );
    expect(launcherStackReducer(initialStackState, { type: "reset" })).toBe(
      initialStackState
    );
  });
});

describe("lookup view", () => {
  it("pushes a lookup with its value and connection", () => {
    const view = {
      connectionId: "db",
      kind: "lookup",
      value: { kind: "integer", value: "42" },
    } as const;
    expect(
      launcherStackReducer(initialStackState, { type: "push", view }).stack
    ).toStrictEqual([ROOT_VIEW, view]);
  });
});
