import type { Watch } from "@conch/rpc";

import { INITIAL_ALERT_STATE } from "@conch/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SchedulerPorts, WatchReport } from "./widget-scheduler.ts";

import {
  CHANGE_THROTTLE_MS,
  createWidgetScheduler,
  MIN_TICK_MS,
  WAKE_GRACE_MS,
  WAKE_SPACING_MS,
} from "./widget-scheduler.ts";

const MINUTE = 60_000;

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}
const STAMP = "2026-11-19T09:00:00.000Z";

const watchOf = (id: string, overrides: Partial<Watch> = {}): Watch => ({
  alert: null,
  alertState: INITIAL_ALERT_STATE,
  createdAt: STAMP,
  id,
  interval: "1m",
  menuBar: false,
  paused: false,
  updatedAt: STAMP,
  values: {},
  version: 1,
  widgetId: `widget-${id}`,
  ...overrides,
});

interface PendingRun {
  watch: Watch;
  signal: AbortSignal;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface HarnessOptions {
  watches: Watch[];
  connections?: Record<string, string | null>;
  hold?: boolean;
  fail?: (watch: Watch) => unknown;
}

const harness = ({
  watches,
  connections = {},
  hold = false,
  fail,
}: HarnessOptions) => {
  const lastSample = new Map<string, number>();
  const pending: PendingRun[] = [];
  const started: { id: string; at: number }[] = [];
  const reports: { id: string; report: WatchReport<string> }[] = [];
  const pausedConnections = new Set<string>();
  const state = { globallyPaused: false, power: "ac" as "ac" | "battery" };
  const changed = vi.fn();

  const ports: SchedulerPorts<string> = {
    changed,
    clearTimer: (handle) => clearTimeout(handle),
    connectionOf: (watch) =>
      resolved(
        watch.id in connections
          ? (connections[watch.id] ?? null)
          : `conn-${watch.id}`
      ),
    isPaused: (connectionId) => pausedConnections.has(connectionId),
    lastSampleAt: (watch) => resolved(lastSample.get(watch.id) ?? null),
    listWatches: () => resolved(watches),
    now: () => Date.now(),
    power: () => state.power,
    report: (watch, report) => {
      reports.push({ id: watch.id, report });
      return Promise.resolve();
    },
    run: (watch, signal) => {
      started.push({ at: Date.now(), id: watch.id });
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      const succeed = () => {
        lastSample.set(watch.id, Date.now());
        resolve(`ran ${watch.id}`);
      };
      const failure = fail?.(watch);
      if (failure) {
        reject(failure);
      } else if (hold) {
        pending.push({ reject, resolve: succeed, signal, watch });
      } else {
        succeed();
      }
      return promise;
    },
    setTimer: (run, ms) => setTimeout(run, ms),
    watchingPaused: () => resolved(state.globallyPaused),
  };
  const scheduler = createWidgetScheduler(ports);
  const runsOf = (id: string) => started.filter((run) => run.id === id);
  const statusOf = (id: string) =>
    scheduler.statuses().find((status) => status.watchId === id);
  return {
    changed,
    lastSample,
    pausedConnections,
    pending,
    reports,
    runsOf,
    scheduler,
    started,
    state,
    statusOf,
  };
};

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("widget scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a never-sampled watch on the first tick, then once per interval", async () => {
    const h = harness({ watches: [watchOf("a")] });
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    expect(h.runsOf("a")).toHaveLength(1);
    expect(h.reports.at(-1)).toStrictEqual({
      id: "a",
      report: { ok: true, outcome: "ran a" },
    });

    await advance(MINUTE - MIN_TICK_MS);
    expect(h.runsOf("a")).toHaveLength(1);
    await advance(2 * MIN_TICK_MS);
    expect(h.runsOf("a")).toHaveLength(2);
    expect(h.statusOf("a")).toMatchObject({ error: null, state: "idle" });
    h.scheduler.stop();
  });

  it("waits for a recent foreground sample instead of running again", async () => {
    const h = harness({ watches: [watchOf("a", { interval: "5m" })] });
    h.lastSample.set("a", Date.now() - MINUTE);
    h.scheduler.start();
    await advance(3 * MINUTE);
    expect(h.runsOf("a")).toHaveLength(0);
    expect(h.statusOf("a")?.nextRunAt).toBe(Date.now() + MINUTE);
    await advance(MINUTE + MIN_TICK_MS);
    expect(h.runsOf("a")).toHaveLength(1);
    h.scheduler.stop();
  });

  it("runs at most two at once and one per connection", async () => {
    const h = harness({
      connections: { a: "shared", b: "shared", c: "other", d: "third" },
      hold: true,
      watches: ["a", "b", "c", "d"].map((id) => watchOf(id)),
    });
    const states = () =>
      ["a", "b", "c", "d"].map((id) => h.statusOf(id)?.state);
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    expect(h.started.map((run) => run.id)).toStrictEqual(["a", "c"]);
    expect(states()).toStrictEqual([
      "running",
      "waiting",
      "running",
      "waiting",
    ]);

    h.pending.shift()?.resolve();
    await advance(MIN_TICK_MS);
    expect(h.started.map((run) => run.id)).toStrictEqual(["a", "c", "b"]);
    expect(states()).toStrictEqual(["idle", "running", "running", "waiting"]);
    h.scheduler.stop();
  });

  it("uses a 15 minute floor on battery", async () => {
    const h = harness({ watches: [watchOf("a")] });
    h.state.power = "battery";
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    await advance(10 * MINUTE);
    expect(h.runsOf("a")).toHaveLength(1);
    await advance(6 * MINUTE);
    expect(h.runsOf("a")).toHaveLength(2);
    h.scheduler.stop();
  });

  it("after a wake waits out the grace period, then runs each overdue watch once, spaced", async () => {
    const h = harness({ watches: [watchOf("a"), watchOf("b")] });
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    const before = h.started.length;

    vi.setSystemTime(Date.now() + 10 * MINUTE);
    await advance(MIN_TICK_MS);
    expect(h.started).toHaveLength(before);
    expect(h.statusOf("a")?.nextRunAt).toBeGreaterThan(Date.now());

    await advance(WAKE_GRACE_MS);
    expect(h.started.slice(before)).toHaveLength(1);
    await advance(WAKE_SPACING_MS);
    await advance(30_000);
    const resumed = h.started.slice(before);
    expect(resumed.map((run) => run.id).toSorted()).toStrictEqual(["a", "b"]);
    const times = resumed.map((run) => run.at);
    expect(Math.max(...times) - Math.min(...times)).toBe(WAKE_SPACING_MS);
    h.scheduler.stop();
  });

  it("never reconnects a connection the user disconnected", async () => {
    const h = harness({ watches: [watchOf("a")] });
    h.pausedConnections.add("conn-a");
    h.scheduler.start();
    await advance(5 * MINUTE);
    expect(h.started).toHaveLength(0);
    expect(h.statusOf("a")?.state).toBe("paused");

    h.pausedConnections.delete("conn-a");
    h.scheduler.refresh();
    await advance(MIN_TICK_MS);
    expect(h.started).toHaveLength(1);
    h.scheduler.stop();
  });

  it("stops everything while watching is paused globally or per watch", async () => {
    const h = harness({
      watches: [watchOf("a"), watchOf("b", { paused: true })],
    });
    h.state.globallyPaused = true;
    h.scheduler.start();
    await advance(5 * MINUTE);
    expect(h.started).toHaveLength(0);
    expect(h.statusOf("a")?.state).toBe("paused");

    h.state.globallyPaused = false;
    await advance(MINUTE);
    expect(h.started.map((run) => run.id)).toStrictEqual(["a"]);
    expect(h.statusOf("b")?.state).toBe("paused");
    h.scheduler.stop();
  });

  it("skips a watch whose widget is gone without retrying it", async () => {
    const h = harness({ connections: { a: null }, watches: [watchOf("a")] });
    h.scheduler.start();
    await advance(10 * MINUTE);
    expect(h.started).toHaveLength(0);
    expect(h.statusOf("a")).toMatchObject({
      error: { code: "WIDGET_NOT_FOUND" },
      state: "error",
    });
    h.scheduler.stop();
  });

  it("stops retrying a missing connection until something changes", async () => {
    const missing = Object.assign(new Error("gone"), {
      code: "CONNECTION_MISSING",
    });
    const h = harness({ fail: () => missing, watches: [watchOf("a")] });
    h.scheduler.start();
    await advance(30 * MINUTE);
    expect(h.started).toHaveLength(1);
    expect(h.reports.at(-1)?.report).toStrictEqual({
      failure: { code: "CONNECTION_MISSING", message: "gone" },
      ok: false,
    });
    h.scheduler.refresh();
    await advance(MIN_TICK_MS);
    expect(h.started).toHaveLength(2);
    h.scheduler.stop();
  });

  it("backs off after failures instead of looping", async () => {
    const h = harness({
      fail: () => new Error("timeout"),
      watches: [watchOf("a")],
    });
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    expect(h.started).toHaveLength(1);
    await advance(2 * MINUTE);
    expect(h.started).toHaveLength(2);
    await advance(4 * MINUTE);
    expect(h.started).toHaveLength(3);
    expect(h.statusOf("a")).toMatchObject({
      error: { code: "QUERY_FAILED", message: "timeout" },
      failures: 3,
      state: "error",
    });
    h.scheduler.stop();
  });

  it("aborts in-flight runs on stop and reports nothing", async () => {
    const h = harness({ hold: true, watches: [watchOf("a")] });
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    const [run] = h.pending;
    h.scheduler.stop();
    expect(run?.signal.aborted).toBeTruthy();
    run?.reject(new Error("aborted"));
    await advance(10 * MINUTE);
    expect(h.reports).toHaveLength(0);
    expect(h.started).toHaveLength(1);
  });

  it("announces status changes at most once a second", async () => {
    const h = harness({
      hold: true,
      watches: ["a", "b"].map((id) => watchOf(id)),
    });
    h.scheduler.start();
    await advance(MIN_TICK_MS);
    expect(h.changed).toHaveBeenCalledOnce();
    await advance(CHANGE_THROTTLE_MS);
    expect(h.changed).toHaveBeenCalledTimes(2);
    h.scheduler.stop();
  });
});
