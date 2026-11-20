import type {
  RunSample,
  Watch as WatchRecord,
  WatchDraft as WatchDraftRecord,
  WatchStatus,
  Widget,
  WidgetRunResult,
  WidgetTrend,
} from "@oh-my-query/rpc";

import {
  formatScalarValue,
  hasUnseenAlert,
  INITIAL_ALERT_STATE,
  isKpiSpec,
  trendOfEntry,
  Watch,
  WATCH_INTERVAL_MS,
  WatchDraft,
} from "@oh-my-query/rpc";

const STUB_VALUES_KEY = "00000000000000aa";
const SAMPLE_AFTER_SAVE_MS = 900;
const HISTORY_STEP_MS = 5 * 60_000;

// A gently falling MRR so trends point down and a "below $50k" alert fires.
export const KPI_SERIES = [
  52_400, 51_900, 52_100, 51_300, 50_800, 50_100, 49_400, 48_200, 47_900,
  47_300,
];
export const SEEDED_SAMPLES = 8;

const HASH_MODULUS = 4_294_967_291;

const hex = (multiplier: number, text: string): string => {
  let hash = 0;
  for (const char of text) {
    hash = (hash * multiplier + (char.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }
  return hash.toString(16).padStart(8, "0");
};

// Stub digests only need to tell results apart, not resist collisions.
const digestOf = (rows: unknown): string => {
  const text = JSON.stringify(rows);
  return `${hex(31, text)}${hex(131, text)}`;
};

const conditionHolds = (watch: WatchRecord, sample: RunSample): boolean => {
  const { alert } = watch;
  switch (alert?.kind) {
    case "below": {
      return sample.value !== null && sample.value < alert.threshold;
    }
    case "above": {
      return sample.value !== null && sample.value > alert.threshold;
    }
    case "hasRows": {
      return sample.rowCount > 0;
    }
    default: {
      return false;
    }
  }
};

const evaluate = (watch: WatchRecord, sample: RunSample): WatchRecord =>
  conditionHolds(watch, sample) && watch.alertState.armed
    ? {
        ...watch,
        alertState: {
          ...watch.alertState,
          armed: false,
          lastFiredAt: sample.at,
        },
      }
    : watch;

interface WatchEmulatorDeps {
  now: () => Date;
  widgetById: (widgetId: string) => Widget | null;
  onWatchesChanged: () => void;
  onSampled: (widgetId: string, valuesKey: string) => void;
}

interface Series {
  cursor: number;
  samples: RunSample[];
}

export const createWatchEmulator = ({
  now,
  widgetById,
  onWatchesChanged,
  onSampled,
}: WatchEmulatorDeps) => {
  const watches = new Map<string, WatchRecord>();
  const series = new Map<string, Series>();
  const state = { paused: false };

  const kpiSample = (value: number, at: Date): RunSample => ({
    at: at.toISOString(),
    digest: digestOf([[value]]),
    rowCount: 1,
    value,
  });

  const seriesFor = (widget: Widget): Series => {
    const existing = series.get(widget.id);
    if (existing) {
      return existing;
    }
    const start = now().getTime() - SEEDED_SAMPLES * HISTORY_STEP_MS;
    const seeded: Series = {
      cursor: SEEDED_SAMPLES,
      samples: isKpiSpec(widget.spec)
        ? KPI_SERIES.slice(0, SEEDED_SAMPLES).map((value, index) =>
            kpiSample(value, new Date(start + index * HISTORY_STEP_MS))
          )
        : [],
    };
    series.set(widget.id, seeded);
    return seeded;
  };

  const trendOf = (widget: Widget): WidgetTrend =>
    trendOfEntry({
      id: `${widget.id}:${STUB_VALUES_KEY}`,
      samples: seriesFor(widget).samples,
      valuesKey: STUB_VALUES_KEY,
      widgetId: widget.id,
    });

  const currentValue = (widget: Widget): number => {
    const { samples } = seriesFor(widget);
    return samples.at(-1)?.value ?? KPI_SERIES[0] ?? 0;
  };

  const append = (widget: Widget, sample: RunSample) => {
    const entry = seriesFor(widget);
    entry.samples = [...entry.samples, sample].slice(-30);
    onSampled(widget.id, STUB_VALUES_KEY);
  };

  const nextKpiSample = (widget: Widget): RunSample => {
    const entry = seriesFor(widget);
    const value = KPI_SERIES[entry.cursor % KPI_SERIES.length] ?? 0;
    entry.cursor += 1;
    return kpiSample(value, now());
  };

  const sampleWatch = (watchId: string) => {
    const watch = watches.get(watchId);
    const widget = watch ? widgetById(watch.widgetId) : null;
    if (!(watch && widget) || watch.paused || state.paused) {
      return;
    }
    const sample = isKpiSpec(widget.spec)
      ? nextKpiSample(widget)
      : { ...kpiSample(0, now()), value: null };
    append(widget, sample);
    watches.set(watch.id, evaluate(watch, sample));
    onWatchesChanged();
  };

  const statusOf = (watch: WatchRecord): WatchStatus => {
    const widget = widgetById(watch.widgetId);
    const latest = widget ? seriesFor(widget).samples.at(-1) : undefined;
    const lastRunAt = latest?.at ?? null;
    return {
      display:
        widget && latest?.value !== null && latest?.value !== undefined
          ? formatScalarValue(widget.spec, latest.value)
          : null,
      error: null,
      lastRunAt,
      nextRunAt: lastRunAt
        ? new Date(
            Date.parse(lastRunAt) + WATCH_INTERVAL_MS[watch.interval]
          ).toISOString()
        : null,
      state: watch.paused || state.paused ? "paused" : "idle",
      watchId: watch.id,
    };
  };

  return {
    acknowledgeAlert: ({ watchId }: { watchId: string }) => {
      const watch = watches.get(watchId);
      if (watch && hasUnseenAlert(watch)) {
        watches.set(watchId, {
          ...watch,
          alertState: { ...watch.alertState, seenAt: now().toISOString() },
        });
        onWatchesChanged();
      }
    },

    decorateRun: (widgetId: string, outcome: WidgetRunResult) => {
      const widget = widgetById(widgetId);
      if (!widget) {
        return outcome;
      }
      const { view } = widget.spec;
      if (view.kind !== "kpi") {
        append(widget, {
          at: now().toISOString(),
          digest: digestOf(outcome.result.rows),
          rowCount: outcome.result.rowCount,
          value: null,
        });
        return { ...outcome, trend: trendOf(widget) };
      }
      const value = currentValue(widget);
      append(widget, kpiSample(value, now()));
      return {
        ...outcome,
        result: {
          ...outcome.result,
          columns: [{ name: view.value, typeName: "NUMERIC" }],
          rowCount: 1,
          rows: [[value]],
        },
        trend: trendOf(widget),
      };
    },

    deleteWatch: ({ watchId }: { watchId: string }) => {
      watches.delete(watchId);
      onWatchesChanged();
    },

    getWatchingPaused: () => state.paused,

    listWatchStatuses: () => [...watches.values()].map(statusOf),

    listWatches: () => [...watches.values()],

    listWidgetTrends: ({ widgetIds }: { widgetIds: string[] }) =>
      Object.fromEntries(
        widgetIds.flatMap((id) => {
          const widget = widgetById(id);
          return widget ? [[id, trendOf(widget)]] : [];
        })
      ),

    removeWidget: (widgetId: string) => {
      for (const [id, watch] of watches) {
        if (watch.widgetId === widgetId) {
          watches.delete(id);
        }
      }
      series.delete(widgetId);
      onWatchesChanged();
    },

    saveWatch: ({ watch: input }: { watch: WatchDraftRecord }) => {
      const draft = WatchDraft.parse(input);
      const existing = [...watches.values()].find(
        (watch) => watch.id === draft.id || watch.widgetId === draft.widgetId
      );
      if (draft.menuBar) {
        for (const [id, watch] of watches) {
          watches.set(id, { ...watch, menuBar: false });
        }
      }
      const stamp = now().toISOString();
      const watch = Watch.parse({
        ...draft,
        alertState:
          existing &&
          JSON.stringify(existing.alert) === JSON.stringify(draft.alert)
            ? existing.alertState
            : INITIAL_ALERT_STATE,
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? crypto.randomUUID(),
        updatedAt: stamp,
        version: 1,
      });
      watches.set(watch.id, watch);
      onWatchesChanged();
      setTimeout(() => sampleWatch(watch.id), SAMPLE_AFTER_SAVE_MS);
      return watch;
    },

    setWatchingPaused: ({ paused }: { paused: boolean }) => {
      state.paused = paused;
      onWatchesChanged();
    },
  };
};
