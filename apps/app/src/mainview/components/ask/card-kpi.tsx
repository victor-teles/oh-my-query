import type { CardResult } from "@/lib/card-data";
import type { CardSpec, CardView } from "@/lib/ipc";

import {
  columnValues,
  formatContextFor,
  formatFor,
  formatValue,
  humanize,
  toNumber,
} from "@/lib/card-data";
import { cn } from "@/lib/utils";

type KpiView = Extract<CardView, { kind: "kpi" }>;

interface CardKpiProps {
  view: KpiView;
  result: CardResult;
  formats: CardSpec["formats"];
}

const firstValue = (result: CardResult, name: string): unknown =>
  columnValues(result, name)[0] ?? null;

export function CardKpi({ view, result, formats }: CardKpiProps) {
  const values = columnValues(result, view.value);
  const value = firstValue(result, view.value);
  const formatted = formatValue(
    value,
    formatFor({ formats }, view.value, values),
    formatContextFor(values)
  );
  const delta = view.delta ? firstValue(result, view.delta) : null;
  const deltaNumber = toNumber(delta);

  return (
    <div className="flex flex-col gap-1 px-4 pt-2 pb-5">
      <span className="type-meta text-panel-muted">
        {view.label ?? humanize(view.value)}
      </span>
      <span
        className="text-[40px] leading-[44px] font-semibold tracking-tight text-foreground tabular-nums"
        data-testid="kpi-value"
      >
        {formatted}
      </span>
      {view.delta && deltaNumber !== null ? (
        <span
          className={cn(
            "type-meta tabular-nums",
            deltaNumber < 0 ? "text-danger-ink" : "text-success-ink"
          )}
        >
          {deltaNumber > 0 ? "+" : ""}
          {formatValue(
            delta,
            formatFor({ formats }, view.delta, [delta]),
            formatContextFor([delta])
          )}{" "}
          <span className="text-panel-muted">{humanize(view.delta)}</span>
        </span>
      ) : null}
    </div>
  );
}
