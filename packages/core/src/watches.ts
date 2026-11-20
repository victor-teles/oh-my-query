import type { Identified, RecordParser } from "./records.ts";

import { runLogPath, watchesPath } from "./paths.ts";
import { createRecordStore, updateRecords } from "./records.ts";

interface WidgetOwned extends Identified {
  widgetId: string;
}

const belongsTo = (record: Identified, widgetId: string): boolean =>
  (record as Partial<WidgetOwned>).widgetId === widgetId;

export const createWatchStore = <T extends WidgetOwned>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(watchesPath, parse);
  return {
    get: store.get,
    list: store.list,
    remove: store.remove,
    removeForWidget: (widgetId: string): Promise<void> =>
      updateRecords(watchesPath(), (records) =>
        records.filter((record) => !belongsTo(record, widgetId))
      ),
    save: store.save,
    update: store.update,
  };
};

export interface RunLogSample {
  at: string;
}

export interface RunLogRecord<S extends RunLogSample> extends WidgetOwned {
  valuesKey: string;
  samples: S[];
}

export interface RunLogLimits {
  maxSamples: number;
  maxEntriesPerWidget: number;
}

export const runLogEntryId = (widgetId: string, valuesKey: string): string =>
  `${widgetId}:${valuesKey}`;

const latestAt = <S extends RunLogSample>(entry: RunLogRecord<S>): string =>
  entry.samples.at(-1)?.at ?? "";

const byLatestSample = <S extends RunLogSample>(
  a: RunLogRecord<S>,
  b: RunLogRecord<S>
): number => latestAt(a).localeCompare(latestAt(b));

export const createRunLogStore = <S extends RunLogSample>(
  parse: RecordParser<RunLogRecord<S>>,
  limits: RunLogLimits
) => {
  const store = createRecordStore(runLogPath, parse);

  const parsedFor = (
    records: readonly Identified[],
    widgetId: string
  ): RunLogRecord<S>[] =>
    records.flatMap((record) => {
      const parsed = parse(record);
      return parsed?.widgetId === widgetId ? [parsed] : [];
    });

  return {
    async append(
      widgetId: string,
      valuesKey: string,
      sample: S
    ): Promise<RunLogRecord<S>> {
      const id = runLogEntryId(widgetId, valuesKey);
      let appended: RunLogRecord<S> = {
        id,
        samples: [sample],
        valuesKey,
        widgetId,
      };
      await updateRecords(runLogPath(), (records) => {
        const siblings = parsedFor(records, widgetId);
        const existing = siblings.find((entry) => entry.id === id);
        appended = {
          ...appended,
          samples: [...(existing?.samples ?? []), sample].slice(
            -limits.maxSamples
          ),
        };
        const others = siblings.filter((entry) => entry.id !== id);
        const overflow = others.length + 1 - limits.maxEntriesPerWidget;
        const evicted = new Set(
          others
            .toSorted(byLatestSample)
            .slice(0, Math.max(0, overflow))
            .map((entry) => entry.id)
        );
        return [
          ...records.filter(
            (record) => record.id !== id && !evicted.has(record.id)
          ),
          appended,
        ];
      });
      return appended;
    },

    entry: (widgetId: string, valuesKey: string) =>
      store.get(runLogEntryId(widgetId, valuesKey)),

    async latestFor(
      widgetIds: readonly string[]
    ): Promise<Record<string, RunLogRecord<S>>> {
      const wanted = new Set(widgetIds);
      const latest: Record<string, RunLogRecord<S>> = {};
      for (const entry of await store.list()) {
        const current = latest[entry.widgetId];
        if (
          wanted.has(entry.widgetId) &&
          (!current || byLatestSample(current, entry) < 0)
        ) {
          latest[entry.widgetId] = entry;
        }
      }
      return latest;
    },

    removeForWidget: (widgetId: string): Promise<void> =>
      updateRecords(runLogPath(), (records) =>
        records.filter((record) => !belongsTo(record, widgetId))
      ),
  };
};
