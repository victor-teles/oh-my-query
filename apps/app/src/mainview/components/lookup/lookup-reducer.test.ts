import { describe, expect, it } from "vitest";

import type { LookupEvent, LookupHit } from "@/lib/ipc";

import type { LookupAction, LookupState } from "./lookup-reducer";

import { initialLookupState, lookupReducer } from "./lookup-reducer";

const VALUE = { kind: "integer", value: "42" } as const;

const hit = (rank: number, table: string): LookupHit => ({
  capped: false,
  column: "id",
  elapsedMs: 3,
  matchedRows: 1,
  rank,
  schema: "public",
  table,
});

const PLANNED: LookupEvent = {
  probes: 4,
  skipped: { largeUnindexed: 1, outOfRange: 0, overLimit: 0 },
  tables: 3,
  type: "planned",
};

const run = (events: LookupEvent[], lookupId = "l1"): LookupState => {
  let state = lookupReducer(initialLookupState, {
    connectionId: "db",
    lookupId: "l1",
    type: "start",
    value: VALUE,
  });
  for (const event of events) {
    state = lookupReducer(state, { event, lookupId, type: "event" });
  }
  return state;
};

describe("lookupReducer", () => {
  it("starts planning with the value and connection", () => {
    expect(run([])).toMatchObject({
      connectionId: "db",
      hits: [],
      status: "planning",
      value: VALUE,
    });
  });

  it("keeps hits in rank order whatever order they arrive in", () => {
    const state = run([
      PLANNED,
      { hit: hit(2, "events"), type: "hit" },
      { hit: hit(0, "users"), type: "hit" },
      { hit: hit(1, "orders"), type: "hit" },
    ]);
    expect(state.hits.map((item) => item.table)).toStrictEqual([
      "users",
      "orders",
      "events",
    ]);
    expect(state.firstHit?.table).toBe("events");
    expect(state).toMatchObject({ status: "probing", tables: 3, total: 4 });
  });

  it("counts progress and failed probes, then finishes", () => {
    const state = run([
      PLANNED,
      { done: 1, total: 4, type: "progress" },
      { column: "id", reason: "timeout", table: "big", type: "probeFailed" },
      { done: 2, total: 4, type: "progress" },
      { budgetExceeded: true, elapsedMs: 412, type: "done" },
    ]);
    expect(state).toMatchObject({
      budgetExceeded: true,
      done: 2,
      elapsedMs: 412,
      failed: 1,
      skipped: { largeUnindexed: 1 },
      status: "done",
    });
  });

  it.each([
    [
      "an error",
      { code: "NO_CANDIDATES", message: "No columns.", type: "error" },
      {
        error: { code: "NO_CANDIDATES", message: "No columns." },
        status: "error",
      },
    ],
    [
      "a cancellation",
      { code: "CANCELLED", message: "Stopped.", type: "error" },
      { error: null, status: "cancelled" },
    ],
  ] as const)("ends on %s", (_label, event, expected) => {
    expect(run([PLANNED, event])).toMatchObject(expected);
  });

  it("ignores events for a stale lookup and after the end", () => {
    const stale = run([PLANNED], "old");
    expect(stale.status).toBe("planning");
    const finished = run([
      PLANNED,
      { budgetExceeded: false, elapsedMs: 9, type: "done" },
      { hit: hit(0, "late"), type: "hit" },
    ]);
    expect(finished.hits).toStrictEqual([]);
  });

  it("stops only while searching", () => {
    const cancel: LookupAction = { type: "cancel" };
    expect(lookupReducer(run([PLANNED]), cancel).status).toBe("cancelled");
    expect(lookupReducer(initialLookupState, cancel)).toBe(initialLookupState);
  });
});
