import type { Identified, RecordParser } from "./records.ts";

import { recentAsksPath, widgetsPath } from "./paths.ts";
import { createRecordStore, updateRecords } from "./records.ts";

export type { RecordParser } from "./records.ts";

export const MAX_RECENT_ASKS = 200;

interface RecentAskKey extends Identified {
  prompt: string;
  connectionId: string;
}

export const createWidgetStore = <T extends Identified>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(widgetsPath, parse);
  return {
    deleteWidget: store.remove,
    getWidget: store.get,
    listWidgets: store.list,
    saveWidget: store.save,
    updateWidget: store.update,
  };
};

// A refined chain reuses its first ask's id, so it keeps one entry that
// always holds its latest turn.
const sameAsk = (a: RecentAskKey, b: unknown): boolean => {
  const other = b as Partial<RecentAskKey>;
  if (other.id === a.id) {
    return true;
  }
  return (
    other.connectionId === a.connectionId &&
    typeof other.prompt === "string" &&
    other.prompt.trim().toLowerCase() === a.prompt.trim().toLowerCase()
  );
};

export const createRecentAskStore = <T extends RecentAskKey>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(recentAsksPath, parse);
  return {
    clearRecentAsks: (): Promise<void> =>
      updateRecords(recentAsksPath(), () => []),
    async listRecentAsks(limit?: number): Promise<T[]> {
      const asks = await store.list();
      return limit === undefined ? asks : asks.slice(0, limit);
    },
    async pushRecentAsk(ask: T): Promise<void> {
      await updateRecords(recentAsksPath(), (records) =>
        [ask, ...records.filter((record) => !sameAsk(ask, record))].slice(
          0,
          MAX_RECENT_ASKS
        )
      );
    },
    removeRecentAsk: store.remove,
  };
};
