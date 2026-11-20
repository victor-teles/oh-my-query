import { newWatchDraft } from "@conch/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Widget } from "@/lib/ipc";

import { makeKpiWidget } from "@/test/watch-fixtures";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { createWatchEmulator, KPI_SERIES } from "./browser-watch-stub";

const setup = (widgets: Widget[] = [makeKpiWidget(), makeWidget()]) => {
  const onWatchesChanged = vi.fn();
  const onSampled = vi.fn();
  const emulator = createWatchEmulator({
    now: () => new Date(),
    onSampled,
    onWatchesChanged,
    widgetById: (id) => widgets.find((widget) => widget.id === id) ?? null,
  });
  return { emulator, onSampled, onWatchesChanged };
};

describe("browser watch emulator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds a falling KPI history so trends render", () => {
    const { emulator } = setup();
    const trends = emulator.listWidgetTrends({ widgetIds: ["w-mrr", "nope"] });
    expect(Object.keys(trends)).toStrictEqual(["w-mrr"]);
    expect(trends["w-mrr"]?.latest?.value).toBe(48_200);
    expect(trends["w-mrr"]?.series).toStrictEqual(KPI_SERIES.slice(0, 8));
  });

  it("runs a KPI widget on the series value and returns its trend", () => {
    const { emulator, onSampled } = setup();
    const outcome = emulator.decorateRun("w-mrr", runResult());
    expect(outcome.result.rows).toStrictEqual([[48_200]]);
    expect(outcome.result.columns).toStrictEqual([
      { name: "mrr", typeName: "NUMERIC" },
    ]);
    expect(outcome.trend?.series).toHaveLength(9);
    expect(onSampled).toHaveBeenCalledWith("w-mrr", "00000000000000aa");
  });

  it("keeps other widgets' rows and records them without a value", () => {
    const { emulator } = setup();
    const outcome = emulator.decorateRun("w-revenue", runResult());
    expect(outcome.result.rowCount).toBe(3);
    expect(outcome.trend?.latest?.value).toBeNull();
    expect(emulator.decorateRun("gone", runResult()).trend).toBeUndefined();
  });

  it("fires a below alert on the sample after saving, then acknowledges it", async () => {
    const { emulator, onWatchesChanged } = setup();
    const watch = emulator.saveWatch({
      watch: {
        ...newWatchDraft("w-mrr", {}),
        alert: { kind: "below", threshold: 50_000 },
        menuBar: true,
      },
    });
    expect(emulator.listWatches()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    const [fired] = emulator.listWatches();
    expect(fired?.alertState.lastFiredAt).not.toBeNull();
    expect(emulator.listWatchStatuses()[0]).toMatchObject({
      display: "$47.9k",
      state: "idle",
      watchId: watch.id,
    });
    emulator.acknowledgeAlert({ watchId: watch.id });
    expect(emulator.listWatches()[0]?.alertState.seenAt).not.toBeNull();
    expect(onWatchesChanged).toHaveBeenCalledTimes(3);
  });

  it("pauses, deletes and forgets watches of deleted widgets", async () => {
    const { emulator } = setup();
    const watch = emulator.saveWatch({ watch: newWatchDraft("w-mrr", {}) });
    emulator.setWatchingPaused({ paused: true });
    expect(emulator.getWatchingPaused()).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(emulator.listWatchStatuses()[0]?.state).toBe("paused");
    emulator.removeWidget("w-mrr");
    expect(emulator.listWatches()).toStrictEqual([]);
    emulator.saveWatch({ watch: newWatchDraft("w-revenue", {}) });
    emulator.deleteWatch({ watchId: watch.id });
    expect(emulator.listWatches()).toHaveLength(1);
  });
});
