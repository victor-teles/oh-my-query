import type {
  ParamValues,
  RunSample,
  Watch,
  WatchDraft,
  Widget,
} from "@oh-my-query/rpc";

import { newWatchDraft } from "@oh-my-query/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrayStatus } from "./tray-status.ts";
import type { WatchStore } from "./watch-service.ts";
import type { DetachedRun } from "./widget-service.ts";

import { createWatchService } from "./watch-service.ts";

const MINUTE = 60_000;

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}
const STAMP = "2026-11-19T09:00:00.000Z";

const widgetOf = (id: string, overrides: Partial<Widget> = {}): Widget => ({
  connectionId: "analytics",
  createdAt: STAMP,
  database: null,
  dialect: "postgresql",
  id,
  lastRunAt: null,
  lastValues: {},
  name: id === "mrr" ? "MRR" : "Signups",
  params: [
    {
      default: "last30d",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
  ],
  prompt: "",
  spec: {
    formats: { mrr: { currency: "USD", kind: "currency" } },
    title: "MRR",
    version: 1,
    view: id === "mrr" ? { kind: "kpi", value: "mrr" } : { kind: "table" },
  },
  sqlTemplate: "select 1",
  updatedAt: STAMP,
  view: id === "mrr" ? "kpi" : "table",
  ...overrides,
});

const memoryWatches = (): WatchStore => {
  const items = new Map<string, Watch>();
  return {
    get: (id) => resolved(items.get(id) ?? null),
    list: () => resolved([...items.values()]),
    remove: (id) => {
      items.delete(id);
      return Promise.resolve();
    },
    removeForWidget: (widgetId) => {
      for (const [id, watch] of items) {
        if (watch.widgetId === widgetId) {
          items.delete(id);
        }
      }
      return Promise.resolve();
    },
    save: (watch) => {
      items.set(watch.id, watch);
      return resolved(watch);
    },
    update: (id, change) => {
      const current = items.get(id);
      if (!current) {
        return resolved(null);
      }
      const next = change(current);
      items.set(id, next);
      return resolved(next);
    },
  };
};

const setup = () => {
  const widgets = new Map([
    ["mrr", widgetOf("mrr")],
    ["signups", widgetOf("signups")],
  ]);
  const samples = new Map<string, RunSample>();
  const values = { mrr: 48_200 } as Record<string, number | Error>;
  const runner = {
    lastSampleFor: vi.fn((widgetId: string) =>
      resolved(samples.get(widgetId) ?? null)
    ),
    runDetached: vi.fn(
      (widgetId: string, runValues: ParamValues): Promise<DetachedRun> => {
        const widget = widgets.get(widgetId);
        const value = values[widgetId] ?? 1;
        if (!widget) {
          return Promise.reject(new Error("missing"));
        }
        if (value instanceof Error) {
          return Promise.reject(value);
        }
        const previous = samples.get(widgetId) ?? null;
        const sample: RunSample = {
          at: new Date().toISOString(),
          digest: "0123456789abcdef",
          rowCount: 1,
          value,
        };
        samples.set(widgetId, sample);
        return resolved({
          compiledSql: "select 1",
          previous,
          result: { columns: [], isTruncated: false, rowCount: 1, rows: [] },
          sample,
          values: runValues,
          valuesKey: "0123456789abcdef",
          widget,
        });
      }
    ),
  };
  const notify = vi.fn();
  const trays: TrayStatus[] = [];
  const broadcast = vi.fn();
  const paused = { value: false };
  const store = memoryWatches();
  const service = createWatchService({
    broadcast,
    clearTimer: (handle) => clearTimeout(handle),
    connectionName: () => resolved("analytics"),
    notify,
    now: () => new Date(),
    power: () => "ac",
    readPaused: () => resolved(paused.value),
    runner,
    setTimer: (run, ms) => setTimeout(run, ms),
    setTray: (status) => trays.push(status),
    watches: store,
    widgets: {
      getWidget: (id) => resolved(widgets.get(id) ?? null),
      listWidgets: () => resolved([...widgets.values()]),
    },
    writePaused: (next) => {
      paused.value = next;
      return Promise.resolve();
    },
  });
  return {
    broadcast,
    notify,
    paused,
    runner,
    samples,
    service,
    store,
    trays,
    values,
    widgets,
  };
};

const draft = (overrides: Partial<WatchDraft> = {}): WatchDraft => ({
  ...newWatchDraft("mrr", { period: "last30d" }),
  ...overrides,
});

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("watch service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a watch with fresh alert state and keeps one per widget", async () => {
    const { broadcast, service } = setup();
    const first = await service.save(draft());
    expect(first).toMatchObject({
      alert: null,
      alertState: { armed: true, lastFiredAt: null },
      interval: "5m",
      version: 1,
      widgetId: "mrr",
    });
    const again = await service.save(draft({ interval: "1m" }));
    expect(again.id).toBe(first.id);
    await expect(service.list()).resolves.toHaveLength(1);
    expect(broadcast).toHaveBeenCalledWith();
  });

  it("allows one menu-bar KPI at a time", async () => {
    const { service, widgets } = setup();
    widgets.set("arr", widgetOf("mrr", { id: "arr", name: "ARR" }));
    await service.save(draft({ menuBar: true }));
    await service.save({ ...draft({ menuBar: true }), widgetId: "arr" });
    const watches = await service.list();
    const pinned = watches.filter((watch) => watch.menuBar);
    expect(pinned.map((watch) => watch.widgetId)).toStrictEqual(["arr"]);
  });

  it("refuses the menu bar and thresholds for non-KPI widgets", async () => {
    const { service } = setup();
    await expect(
      service.save({ ...draft({ menuBar: true }), widgetId: "signups" })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Only KPI widgets can show in the menu bar.",
    });
    await expect(
      service.save({
        ...draft({ alert: { kind: "below", threshold: 1 } }),
        widgetId: "signups",
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.save({
        ...draft({ alert: { kind: "hasRows" } }),
        widgetId: "signups",
      })
    ).resolves.toMatchObject({ alert: { kind: "hasRows" } });
  });

  it("validates values against the widget's inputs", async () => {
    const { service } = setup();
    await expect(
      service.save(draft({ values: { region: "Europe" } }))
    ).rejects.toMatchObject({ message: "Unknown input: region." });
    await expect(
      service.save(draft({ values: { period: "someday" } }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.save({ ...draft(), widgetId: "gone" })
    ).rejects.toMatchObject({ code: "WIDGET_NOT_FOUND" });
  });

  it("notifies once when a threshold alert fires, then stays quiet", async () => {
    const { notify, service } = setup();
    await service.save(
      draft({ alert: { kind: "below", threshold: 50_000 }, interval: "1m" })
    );
    await service.start();
    await advance(5000);
    expect(notify).toHaveBeenCalledExactlyOnceWith({
      body: "MRR is $48.2k, below $50k.",
      subtitle: "analytics",
      title: "MRR",
    });
    const [watch] = await service.list();
    expect(watch?.alertState.lastFiredAt).not.toBeNull();

    await advance(5 * MINUTE);
    expect(notify).toHaveBeenCalledOnce();
    service.stop();
  });

  it("shows the pinned KPI and unseen alerts in the tray until acknowledged", async () => {
    const { service, trays } = setup();
    const watch = await service.save(
      draft({ alert: { kind: "below", threshold: 50_000 }, menuBar: true })
    );
    await service.start();
    await advance(5000);
    const status = trays.at(-1);
    expect(status?.pinned).toMatchObject({
      display: "$48.2k",
      failing: false,
      widgetName: "MRR",
    });
    expect(status?.alerts.map((alert) => alert.label)).toStrictEqual([
      "MRR below $50k",
    ]);

    await service.acknowledge(watch.id);
    expect(trays.at(-1)?.alerts).toStrictEqual([]);
    const statuses = await service.statuses();
    expect(statuses[0]).toMatchObject({ display: "$48.2k", watchId: watch.id });
    service.stop();
  });

  it("posts one failure notice after three failures in a row", async () => {
    const { notify, service, values } = setup();
    values.mrr = new Error("timeout");
    await service.save(draft({ interval: "1m" }));
    await service.start();
    await advance(60 * MINUTE);
    expect(notify).toHaveBeenCalledExactlyOnceWith({
      body: "It failed three times in a row. Open the menu bar to see why.",
      subtitle: "analytics",
      title: "Couldn't check MRR",
    });
    const statuses = await service.statuses();
    expect(statuses[0]).toMatchObject({
      error: { code: "QUERY_FAILED", message: "timeout" },
      state: "error",
    });
    service.stop();
  });

  it("does not run while paused or while its connection is disconnected", async () => {
    const { runner, service } = setup();
    await service.save(draft({ interval: "1m" }));
    await service.setPaused(true);
    await service.start();
    await advance(5 * MINUTE);
    expect(runner.runDetached).not.toHaveBeenCalled();
    await expect(service.isPaused()).resolves.toBeTruthy();

    service.pauseConnection("analytics");
    await service.setPaused(false);
    await advance(5 * MINUTE);
    expect(runner.runDetached).not.toHaveBeenCalled();

    service.connectionUsed("analytics");
    await advance(5000);
    expect(runner.runDetached).toHaveBeenCalledOnce();
    service.stop();
  });

  it("removes a widget's watches and frees the menu bar", async () => {
    const { service, trays } = setup();
    await service.save(draft({ menuBar: true }));
    await service.removeForWidget("mrr");
    await expect(service.list()).resolves.toStrictEqual([]);
    expect(trays.at(-1)?.pinned).toBeNull();
  });
});
