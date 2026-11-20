import type { CardSpec, ParamValues, Widget } from "@/lib/ipc";

import { valuesSummary } from "./param-labels";

// The stored insight and subtitle describe the data the widget was saved
// with, so a run titles the card with the widget and its current inputs.
export const runSpec = (widget: Widget, values: ParamValues): CardSpec => {
  const { insight: _insight, subtitle: _subtitle, ...spec } = widget.spec;
  const summary = valuesSummary(widget, values);
  return {
    ...spec,
    title: widget.name.slice(0, 80),
    ...(summary ? { subtitle: summary.slice(0, 120) } : {}),
  };
};
