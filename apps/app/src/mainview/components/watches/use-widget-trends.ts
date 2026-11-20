import { useEffect, useState } from "react";

import type { WidgetTrend } from "@/lib/ipc";

import { listWidgetTrends, onWidgetSampled } from "@/lib/ipc";

const SEPARATOR = "\n";

// Trends decorate rows; a failed fetch leaves the rows as they were.
export const useWidgetTrends = (
  widgetIds: readonly string[]
): Record<string, WidgetTrend> => {
  const [trends, setTrends] = useState<Record<string, WidgetTrend>>({});
  const idsKey = widgetIds.join(SEPARATOR);

  useEffect(() => {
    if (!idsKey) {
      return;
    }
    const ids = idsKey.split(SEPARATOR);
    let cancelled = false;
    const load = async () => {
      try {
        const next = await listWidgetTrends(ids);
        if (!cancelled) {
          setTrends(next);
        }
      } catch (error) {
        console.error("[watches] could not load trends", error);
      }
    };
    load();
    const unsubscribe = onWidgetSampled(({ widgetId }) => {
      if (ids.includes(widgetId)) {
        load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [idsKey]);

  return trends;
};
