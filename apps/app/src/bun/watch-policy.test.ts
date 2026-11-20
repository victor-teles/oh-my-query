import type { AlertState, RunSample, WatchCondition } from "@oh-my-query/rpc";

import { INITIAL_ALERT_STATE } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import {
  ALERT_COOLDOWN_MS,
  alertMessage,
  effectiveIntervalMs,
  evaluateAlert,
  failureMessage,
  MAX_BACKOFF_MS,
  nextDueAt,
} from "./watch-policy.ts";

const NOW = new Date("2026-11-19T10:00:00.000Z");
const MINUTE = 60_000;

const sample = (
  value: number | null,
  overrides: Partial<RunSample> = {}
): RunSample => ({
  at: NOW.toISOString(),
  digest: "0000000000000001",
  rowCount: 1,
  value,
  ...overrides,
});

const below: WatchCondition = { kind: "below", threshold: 50_000 };

describe("effectiveIntervalMs", () => {
  it.each([
    ["1m", "ac", MINUTE],
    ["1m", "battery", 15 * MINUTE],
    ["5m", "battery", 15 * MINUTE],
    ["15m", "battery", 15 * MINUTE],
    ["1h", "battery", 60 * MINUTE],
    ["1h", "ac", 60 * MINUTE],
  ] as const)("%s on %s is %i ms", (interval, power, expected) => {
    expect(effectiveIntervalMs(interval, power)).toBe(expected);
  });
});

describe("nextDueAt", () => {
  const now = NOW.getTime();

  it("is due now when never sampled", () => {
    expect(
      nextDueAt({
        failures: 0,
        intervalMs: MINUTE,
        lastAttemptAt: null,
        lastSampleAt: null,
        now,
      })
    ).toBe(now);
  });

  it("is due one interval after the last sample", () => {
    expect(
      nextDueAt({
        failures: 0,
        intervalMs: 5 * MINUTE,
        lastAttemptAt: now - MINUTE,
        lastSampleAt: now - MINUTE,
        now,
      })
    ).toBe(now + 4 * MINUTE);
  });

  it.each([
    [1, 2 * MINUTE],
    [2, 4 * MINUTE],
    [3, 8 * MINUTE],
    [10, MAX_BACKOFF_MS],
  ])("backs off after %i failures by %i ms", (failures, delay) => {
    expect(
      nextDueAt({
        failures,
        intervalMs: MINUTE,
        lastAttemptAt: now,
        lastSampleAt: now - 10 * MINUTE,
        now,
      })
    ).toBe(now + delay);
  });
});

const run = (
  condition: WatchCondition,
  values: (number | null)[],
  start: AlertState = INITIAL_ALERT_STATE,
  stepMs = MINUTE
) => {
  let state = start;
  const fired: boolean[] = [];
  for (const [index, value] of values.entries()) {
    const evaluation = evaluateAlert(
      condition,
      null,
      sample(value),
      state,
      new Date(NOW.getTime() + index * stepMs)
    );
    fired.push(evaluation.fire);
    state = evaluation.next;
  }
  return { fired, state };
};

describe("evaluateAlert: thresholds", () => {
  it("fires once when the value crosses below and stays quiet while it stays", () => {
    const { fired, state } = run(below, [52_000, 48_000, 47_000, 46_000]);
    expect(fired).toStrictEqual([false, true, false, false]);
    expect(state.armed).toBeFalsy();
    expect(state.lastFiredAt).toBe(
      new Date(NOW.getTime() + MINUTE).toISOString()
    );
  });

  it("is strict at the threshold and handles above", () => {
    expect(run(below, [50_000]).fired).toStrictEqual([false]);
    expect(run({ kind: "above", threshold: 10 }, [10, 11]).fired).toStrictEqual(
      [false, true]
    );
  });

  it("re-arms only after two false evaluations in a row (hysteresis)", () => {
    const hour = ALERT_COOLDOWN_MS;
    const once = run(
      below,
      [48_000, 51_000, 48_000],
      INITIAL_ALERT_STATE,
      hour
    );
    expect(once.fired).toStrictEqual([true, false, false]);
    expect(once.state.falseStreak).toBe(0);

    const twice = run(
      below,
      [48_000, 51_000, 52_000, 48_000],
      INITIAL_ALERT_STATE,
      hour
    );
    expect(twice.fired).toStrictEqual([true, false, false, true]);
  });

  it("never fires twice within the cooldown even when re-armed", () => {
    const { fired, state } = run(below, [48_000, 51_000, 52_000, 48_000]);
    expect(fired).toStrictEqual([true, false, false, false]);
    expect(state.armed).toBeTruthy();
  });

  it("treats a null value as neither true nor false", () => {
    const fired = run(below, [48_000]).state;
    const evaluation = evaluateAlert(below, null, sample(null), fired, NOW);
    expect(evaluation).toStrictEqual({ fire: false, next: fired });
  });

  it("returns the same state object when nothing changed", () => {
    const evaluation = evaluateAlert(
      below,
      null,
      sample(60_000),
      INITIAL_ALERT_STATE,
      NOW
    );
    expect(evaluation.next).toBe(INITIAL_ALERT_STATE);
  });
});

describe("evaluateAlert: rows and changes", () => {
  it("fires when rows appear", () => {
    const empty = sample(null, { rowCount: 0 });
    const first = evaluateAlert(
      { kind: "hasRows" },
      null,
      empty,
      INITIAL_ALERT_STATE,
      NOW
    );
    expect(first.fire).toBeFalsy();
    const second = evaluateAlert(
      { kind: "hasRows" },
      empty,
      sample(null, { rowCount: 3 }),
      first.next,
      NOW
    );
    expect(second.fire).toBeTruthy();
  });

  it("never fires on the first sample of a changed alert", () => {
    expect(
      evaluateAlert(
        { kind: "changed" },
        null,
        sample(1),
        INITIAL_ALERT_STATE,
        NOW
      ).fire
    ).toBeFalsy();
  });

  it("fires on a new digest and re-arms on the next evaluation", () => {
    const before = sample(1, { digest: "000000000000000a" });
    const after = sample(2, { digest: "000000000000000b" });
    const fired = evaluateAlert(
      { kind: "changed" },
      before,
      after,
      INITIAL_ALERT_STATE,
      NOW
    );
    expect(fired.fire).toBeTruthy();
    const rearmed = evaluateAlert(
      { kind: "changed" },
      after,
      before,
      fired.next,
      new Date(NOW.getTime() + 2 * ALERT_COOLDOWN_MS)
    );
    expect(rearmed).toMatchObject({ fire: false, next: { armed: true } });
    const unchanged = evaluateAlert(
      { kind: "changed" },
      after,
      after,
      rearmed.next,
      NOW
    );
    expect(unchanged.fire).toBeFalsy();
  });
});

describe("alertMessage", () => {
  it("writes plain sentences per condition", () => {
    const base = {
      display: "$48.2k",
      rowCount: 3,
      thresholdDisplay: "$50k",
      widgetName: "MRR",
    };
    expect(alertMessage({ ...base, condition: below })).toStrictEqual({
      body: "MRR is $48.2k, below $50k.",
      title: "MRR",
    });
    expect(
      alertMessage({ ...base, condition: { kind: "above", threshold: 1 } }).body
    ).toBe("MRR is $48.2k, above $50k.");
    expect(
      alertMessage({
        ...base,
        condition: { kind: "hasRows" },
        widgetName: "Failed payments",
      })
    ).toStrictEqual({ body: "3 rows match now.", title: "Failed payments" });
    expect(
      alertMessage({ ...base, condition: { kind: "hasRows" }, rowCount: 1 })
        .body
    ).toBe("1 row matches now.");
    expect(alertMessage({ ...base, condition: { kind: "changed" } }).body).toBe(
      "The result changed."
    );
  });

  it("falls back when no display is known", () => {
    expect(
      alertMessage({
        condition: below,
        display: null,
        rowCount: 0,
        thresholdDisplay: null,
        widgetName: "MRR",
      }).body
    ).toBe("MRR is —, below 50000.");
    expect(failureMessage("MRR").title).toBe("Couldn't check MRR");
  });
});
