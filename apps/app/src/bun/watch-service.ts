import type { createWatchStore } from "@oh-my-query/core";
import type {
  ParamValues,
  RunSample,
  Watch as WatchRecord,
  WatchDraft as WatchDraftRecord,
  WatchStatus,
  Widget,
} from "@oh-my-query/rpc";

import { DbError } from "@oh-my-query/core";
import {
  alertLabel,
  editableParams,
  formatScalarValue,
  formatThreshold,
  hasUnseenAlert,
  INITIAL_ALERT_STATE,
  isKpiSpec,
  MAX_WATCHES,
  paramValueSchema,
  Watch,
  WatchDraft,
} from "@oh-my-query/rpc";
import { z } from "zod";

import type { Notification } from "./alert-notifier.ts";
import type { TrayStatus } from "./tray-status.ts";
import type { PowerSource } from "./watch-policy.ts";
import type {
  ScheduledStatus,
  TimerHandle,
  WatchReport,
} from "./widget-scheduler.ts";
import type { DetachedRun } from "./widget-service.ts";

import {
  alertMessage,
  effectiveIntervalMs,
  evaluateAlert,
  failureMessage,
} from "./watch-policy.ts";
import { createWidgetScheduler } from "./widget-scheduler.ts";

export type WatchStore = ReturnType<typeof createWatchStore<WatchRecord>>;

export const FAILURES_BEFORE_NOTICE = 3;
const TRAY_REFRESH_MS = 60_000;

export interface WatchServiceDeps {
  watches: WatchStore;
  widgets: {
    getWidget(id: string): Promise<Widget | null>;
    listWidgets(): Promise<Widget[]>;
  };
  runner: {
    runDetached(
      widgetId: string,
      values: ParamValues,
      signal: AbortSignal
    ): Promise<DetachedRun>;
    lastSampleFor(
      widgetId: string,
      values: ParamValues
    ): Promise<RunSample | null>;
  };
  connectionName(connectionId: string): Promise<string | null>;
  notify(notification: Notification): void;
  setTray(status: TrayStatus): void;
  broadcast(): void;
  readPaused(): Promise<boolean>;
  writePaused(paused: boolean): Promise<void>;
  power(): PowerSource;
  now(): Date;
  setTimer(run: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
}

const Id = z.string().min(1).max(100);

const invalid = (message: string): DbError =>
  new DbError("INVALID_INPUT", message);

const checkValues = (widget: Widget, values: ParamValues): void => {
  const editable = editableParams(widget.params);
  for (const [name, value] of Object.entries(values)) {
    const def = editable.find((param) => param.name === name);
    if (!def) {
      throw invalid(`Unknown input: ${name}.`);
    }
    const parsed = paramValueSchema(def).safeParse(value);
    if (!parsed.success) {
      throw invalid(
        parsed.error.issues[0]?.message ?? `${def.label} isn't valid.`
      );
    }
  }
};

const checkKpiRules = (widget: Widget, draft: WatchDraftRecord): void => {
  if (isKpiSpec(widget.spec)) {
    return;
  }
  if (draft.menuBar) {
    throw invalid("Only KPI widgets can show in the menu bar.");
  }
  if (draft.alert?.kind === "below" || draft.alert?.kind === "above") {
    throw invalid("Only KPI widgets can alert on a threshold.");
  }
};

const sameCondition = (
  a: WatchRecord["alert"],
  b: WatchRecord["alert"]
): boolean => JSON.stringify(a) === JSON.stringify(b);

const byCreation = (a: WatchRecord, b: WatchRecord): number =>
  a.createdAt.localeCompare(b.createdAt);

const sampleTime = (sample: RunSample | null): number | null =>
  sample ? Date.parse(sample.at) : null;

const displayOf = (widget: Widget, sample: RunSample | null): string | null =>
  sample?.value === null || sample?.value === undefined
    ? null
    : formatScalarValue(widget.spec, sample.value);

const iso = (at: number | null): string | null =>
  at === null ? null : new Date(at).toISOString();

export const createWatchService = (deps: WatchServiceDeps) => {
  const pausedConnections = new Set<string>();
  const failureStreaks = new Map<string, number>();
  const settings = { paused: false };
  let trayTimer: TimerHandle | null = null;

  const widgetsById = async (): Promise<Map<string, Widget>> => {
    const widgets = await deps.widgets.listWidgets();
    return new Map(widgets.map((widget) => [widget.id, widget]));
  };

  const scheduler = createWidgetScheduler<DetachedRun>({
    changed: () => {
      deps.broadcast();
      refreshTray();
    },
    clearTimer: deps.clearTimer,
    connectionOf: async (watch) => {
      const widget = await deps.widgets.getWidget(watch.widgetId);
      return widget?.connectionId ?? null;
    },
    isPaused: (connectionId) => pausedConnections.has(connectionId),
    lastSampleAt: async (watch) =>
      sampleTime(await deps.runner.lastSampleFor(watch.widgetId, watch.values)),
    listWatches: () => deps.watches.list(),
    now: () => deps.now().getTime(),
    power: deps.power,
    report: (watch, report) => handleReport(watch, report),
    run: (watch, signal) => {
      console.log(`[watch] background run of widget ${watch.widgetId}`);
      return deps.runner.runDetached(watch.widgetId, watch.values, signal);
    },
    setTimer: deps.setTimer,
    watchingPaused: () => {
      const { paused } = settings;
      return Promise.resolve(paused);
    },
  });

  const scheduledById = (): Map<string, ScheduledStatus> =>
    new Map(scheduler.statuses().map((status) => [status.watchId, status]));

  const trayStatus = async (): Promise<TrayStatus> => {
    const [watches, widgets] = await Promise.all([
      deps.watches.list(),
      widgetsById(),
    ]);
    const now = deps.now().getTime();
    const pinnedWatch = watches.find((watch) => watch.menuBar);
    const pinnedWidget = pinnedWatch ? widgets.get(pinnedWatch.widgetId) : null;
    let pinned: TrayStatus["pinned"] = null;
    if (pinnedWatch && pinnedWidget) {
      const sample = await deps.runner.lastSampleFor(
        pinnedWatch.widgetId,
        pinnedWatch.values
      );
      const scheduled = scheduledById().get(pinnedWatch.id);
      const lastSuccessAt = sampleTime(sample);
      const lastAttemptAt = scheduled?.lastAttemptAt ?? null;
      pinned = {
        display: displayOf(pinnedWidget, sample),
        failing:
          Boolean(scheduled?.error) &&
          (lastSuccessAt === null || (lastAttemptAt ?? 0) > lastSuccessAt),
        intervalMs: effectiveIntervalMs(pinnedWatch.interval, deps.power()),
        lastAttemptAt,
        lastSuccessAt,
        watchId: pinnedWatch.id,
        widgetId: pinnedWatch.widgetId,
        widgetName: pinnedWidget.name,
      };
    }
    const alerts = watches
      .flatMap((watch) => {
        const widget = widgets.get(watch.widgetId);
        const firedAt = watch.alertState.lastFiredAt;
        return widget && watch.alert && firedAt && hasUnseenAlert(watch)
          ? [
              {
                firedAt: Date.parse(firedAt),
                label: alertLabel(widget.name, watch.alert, widget.spec),
                watchId: watch.id,
                widgetId: watch.widgetId,
              },
            ]
          : [];
      })
      .toSorted((a, b) => b.firedAt - a.firedAt);
    return {
      alerts,
      now,
      paused: settings.paused,
      pinned,
      watching: watches.length,
    };
  };

  const refreshTray = async (): Promise<void> => {
    try {
      deps.setTray(await trayStatus());
    } catch (error) {
      console.error(`[watch] could not update the tray: ${String(error)}`);
    }
  };

  const changed = async (): Promise<void> => {
    deps.broadcast();
    await refreshTray();
  };

  const notifyFor = async (widget: Widget, text: Notification) => {
    const subtitle = await deps.connectionName(widget.connectionId);
    deps.notify(subtitle ? { ...text, subtitle } : text);
  };

  const reportFailure = async (watch: WatchRecord): Promise<void> => {
    const streak = (failureStreaks.get(watch.id) ?? 0) + 1;
    failureStreaks.set(watch.id, streak);
    if (streak !== FAILURES_BEFORE_NOTICE) {
      return;
    }
    const widget = await deps.widgets.getWidget(watch.widgetId);
    if (widget) {
      await notifyFor(widget, failureMessage(widget.name));
    }
  };

  const reportSuccess = async (
    watch: WatchRecord,
    run: DetachedRun
  ): Promise<void> => {
    failureStreaks.delete(watch.id);
    const current = await deps.watches.get(watch.id);
    if (!current?.alert) {
      return;
    }
    const { alert } = current;
    const evaluation = evaluateAlert(
      alert,
      run.previous,
      run.sample,
      current.alertState,
      deps.now()
    );
    if (
      JSON.stringify(evaluation.next) !== JSON.stringify(current.alertState)
    ) {
      await deps.watches.update(current.id, (stored) => ({
        ...stored,
        alertState: evaluation.next,
      }));
    }
    if (!evaluation.fire) {
      return;
    }
    const { widget } = run;
    await notifyFor(
      widget,
      alertMessage({
        condition: alert,
        display: displayOf(widget, run.sample),
        rowCount: run.sample.rowCount,
        thresholdDisplay:
          alert.kind === "below" || alert.kind === "above"
            ? formatThreshold(widget.spec, alert.threshold)
            : null,
        widgetName: widget.name,
      })
    );
  };

  async function handleReport(
    watch: WatchRecord,
    report: WatchReport<DetachedRun>
  ): Promise<void> {
    await (report.ok
      ? reportSuccess(watch, report.outcome)
      : reportFailure(watch));
    await changed();
  }

  const requireWidget = async (widgetId: string): Promise<Widget> => {
    const widget = await deps.widgets.getWidget(widgetId);
    if (!widget) {
      throw new DbError("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const unpinOthers = async (keepId: string): Promise<void> => {
    const watches = await deps.watches.list();
    const pinned = watches.filter(
      (watch) => watch.menuBar && watch.id !== keepId
    );
    for (const watch of pinned) {
      // oxlint-disable-next-line no-await-in-loop -- one menu-bar item at a time
      await deps.watches.update(watch.id, (stored) => ({
        ...stored,
        menuBar: false,
      }));
    }
  };

  return {
    async acknowledge(watchId: string): Promise<void> {
      const id = Id.parse(watchId);
      const stamp = deps.now().toISOString();
      const watch = await deps.watches.get(id);
      if (!(watch && hasUnseenAlert(watch))) {
        return;
      }
      await deps.watches.update(id, (stored) => ({
        ...stored,
        alertState: { ...stored.alertState, seenAt: stamp },
      }));
      await changed();
    },

    connectionUsed(connectionId: string): void {
      if (pausedConnections.delete(connectionId)) {
        scheduler.refresh();
      }
    },

    connectionsChanged(): void {
      scheduler.refresh();
    },

    async isPaused(): Promise<boolean> {
      settings.paused = await deps.readPaused();
      return settings.paused;
    },

    async list(): Promise<WatchRecord[]> {
      const watches = await deps.watches.list();
      return watches.toSorted(byCreation);
    },

    pauseConnection(connectionId: string): void {
      pausedConnections.add(connectionId);
    },

    async remove(watchId: string): Promise<void> {
      await deps.watches.remove(Id.parse(watchId));
      failureStreaks.delete(watchId);
      scheduler.refresh();
      await changed();
    },

    async removeForWidget(widgetId: string): Promise<void> {
      await deps.watches.removeForWidget(Id.parse(widgetId));
      scheduler.refresh();
      await changed();
    },

    async save(input: WatchDraftRecord): Promise<WatchRecord> {
      const draft = WatchDraft.parse(input);
      const widget = await requireWidget(draft.widgetId);
      checkKpiRules(widget, draft);
      checkValues(widget, draft.values);
      const watches = await deps.watches.list();
      const existing =
        watches.find((watch) => watch.id === draft.id) ??
        watches.find((watch) => watch.widgetId === draft.widgetId);
      if (!existing && watches.length >= MAX_WATCHES) {
        throw invalid(`You can watch up to ${MAX_WATCHES} widgets.`);
      }
      const stamp = deps.now().toISOString();
      const watch = Watch.parse({
        ...draft,
        alertState:
          existing && sameCondition(existing.alert, draft.alert)
            ? existing.alertState
            : INITIAL_ALERT_STATE,
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? crypto.randomUUID(),
        updatedAt: stamp,
        version: 1,
      });
      await deps.watches.save(watch);
      if (watch.menuBar) {
        await unpinOthers(watch.id);
      }
      scheduler.refresh();
      await changed();
      return watch;
    },

    async setPaused(paused: boolean): Promise<void> {
      const next = z.boolean().parse(paused);
      await deps.writePaused(next);
      settings.paused = next;
      scheduler.refresh();
      await changed();
    },

    async start(): Promise<void> {
      try {
        settings.paused = await deps.readPaused();
      } catch (error) {
        console.error(
          `[watch] could not read the pause setting: ${String(error)}`
        );
      }
      scheduler.start();
      const keepTrayFresh = () => {
        trayTimer = deps.setTimer(async () => {
          await refreshTray();
          keepTrayFresh();
        }, TRAY_REFRESH_MS);
      };
      await refreshTray();
      keepTrayFresh();
    },

    async statuses(): Promise<WatchStatus[]> {
      const [watches, widgets] = await Promise.all([
        deps.watches.list(),
        widgetsById(),
      ]);
      const scheduled = scheduledById();
      return Promise.all(
        watches.toSorted(byCreation).map(async (watch) => {
          const widget = widgets.get(watch.widgetId);
          const sample = widget
            ? await deps.runner.lastSampleFor(watch.widgetId, watch.values)
            : null;
          const status = scheduled.get(watch.id);
          return {
            display: widget ? displayOf(widget, sample) : null,
            error: status?.error ?? null,
            lastRunAt: sample?.at ?? null,
            nextRunAt: iso(status?.nextRunAt ?? null),
            state: status?.state ?? (watch.paused ? "paused" : "idle"),
            watchId: watch.id,
          };
        })
      );
    },

    stop(): void {
      scheduler.stop();
      if (trayTimer !== null) {
        deps.clearTimer(trayTimer);
        trayTimer = null;
      }
    },
  };
};

export type WatchService = ReturnType<typeof createWatchService>;
