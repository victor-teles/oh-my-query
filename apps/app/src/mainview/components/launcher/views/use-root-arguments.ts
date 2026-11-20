import { useCallback, useState } from "react";

import type { ParamValues, Widget } from "@/lib/ipc";

import { currentValues } from "@/components/widgets/param-labels";

interface OpenArguments {
  widgetId: string;
  values: ParamValues;
}

export const useRootArguments = (widgets: readonly Widget[]) => {
  const [args, setArgs] = useState<OpenArguments | null>(null);
  const widget = args
    ? (widgets.find((item) => item.id === args.widgetId) ?? null)
    : null;

  const open = useCallback(
    (widgetId: string) => {
      const target = widgets.find((item) => item.id === widgetId);
      if (target) {
        setArgs({ values: currentValues(target), widgetId });
      }
    },
    [widgets]
  );
  const close = useCallback(() => setArgs(null), []);
  const change = useCallback(
    (values: ParamValues) =>
      setArgs((current) => (current ? { ...current, values } : current)),
    []
  );

  return { change, close, open, values: args?.values ?? {}, widget };
};
