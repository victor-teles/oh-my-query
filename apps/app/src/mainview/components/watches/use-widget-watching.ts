import { useCallback } from "react";

import type { WidgetWatching } from "@/components/widgets/widget-row";

import { useWidgetTrends } from "./use-widget-trends";
import { glyphKindOf } from "./watch-glyph";
import { useWatches, watchForWidget } from "./watches-provider";

// Everything a widget row shows about its watch: glyph, trend and failure.
export const useWidgetWatching = (widgetIds: readonly string[]) => {
  const { watches, statuses } = useWatches();
  const trends = useWidgetTrends(widgetIds);
  return useCallback(
    (widgetId: string): WidgetWatching => {
      const watch = watchForWidget(watches, widgetId);
      const status = watch ? statuses[watch.id] : undefined;
      return {
        failure: status?.state === "error" ? { since: status.lastRunAt } : null,
        glyph: watch ? glyphKindOf(watch) : null,
        trend: trends[widgetId] ?? null,
      };
    },
    [statuses, trends, watches]
  );
};
