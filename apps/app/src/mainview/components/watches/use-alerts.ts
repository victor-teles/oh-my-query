import { alertLabel, hasUnseenAlert } from "@oh-my-query/rpc";
import { useMemo } from "react";

import type { Watch, Widget } from "@/lib/ipc";

import { useWidgets } from "@/components/widgets/widgets-provider";

import { useWatches } from "./watches-provider";

export interface RootAlert {
  watchId: string;
  widgetId: string;
  label: string;
  firedAt: string;
}

export const alertsOf = (
  watches: readonly Watch[],
  widgets: readonly Widget[]
): RootAlert[] =>
  watches
    .flatMap((watch) => {
      const widget = widgets.find((item) => item.id === watch.widgetId);
      const firedAt = watch.alertState.lastFiredAt;
      return widget && watch.alert && firedAt && hasUnseenAlert(watch)
        ? [
            {
              firedAt,
              label: alertLabel(widget.name, watch.alert, widget.spec),
              watchId: watch.id,
              widgetId: watch.widgetId,
            },
          ]
        : [];
    })
    .toSorted((a, b) => b.firedAt.localeCompare(a.firedAt));

export const useAlerts = () => {
  const { watches, acknowledge } = useWatches();
  const { widgets } = useWidgets();
  const alerts = useMemo(() => alertsOf(watches, widgets), [watches, widgets]);
  return { acknowledge, alerts };
};
