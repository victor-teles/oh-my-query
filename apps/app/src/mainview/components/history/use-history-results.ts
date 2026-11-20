import type { RecentAsk } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";

import type { HistoryEntry } from "./history-search";

import { flattenHistory, historySections } from "./history-search";

export const useHistoryResults = (
  asks: readonly RecentAsk[],
  query: string
) => {
  const { state, activeConnection } = useConnections();
  const entries: HistoryEntry[] = asks.map((ask) => ({
    ask,
    connectionName:
      state.connections.find((connection) => connection.id === ask.connectionId)
        ?.name ?? null,
  }));
  const now = new Date();
  const sections = historySections(entries, query, now);
  return {
    connections: { active: activeConnection, all: state.connections },
    items: flattenHistory(sections),
    now,
    sections,
  };
};
