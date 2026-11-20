import type { CardSpec, CardView } from "@conch/rpc";

import type { ColumnStats } from "./column-stats.ts";

const PIE_MAX_ROWS = 8;

const referencedColumns = (view: CardView): string[] => {
  switch (view.kind) {
    case "chart": {
      return [view.x, ...view.y, ...(view.groupBy ? [view.groupBy] : [])];
    }
    case "pie": {
      return [view.label, view.value];
    }
    case "kpi": {
      return [view.value, ...(view.delta ? [view.delta] : [])];
    }
    case "table": {
      return view.columns ?? [];
    }
    default: {
      return view satisfies never;
    }
  }
};

const numericColumns = (view: CardView): string[] => {
  switch (view.kind) {
    case "chart": {
      return view.y;
    }
    case "pie": {
      return [view.value];
    }
    case "kpi": {
      return [view.value, ...(view.delta ? [view.delta] : [])];
    }
    case "table": {
      return [];
    }
    default: {
      return view satisfies never;
    }
  }
};

const shapeProblem = (view: CardView, rowCount: number): string | null => {
  if (view.kind === "pie" && view.label === view.value) {
    return "A pie chart needs separate label and value columns.";
  }
  if (view.kind === "pie" && (rowCount < 2 || rowCount > PIE_MAX_ROWS)) {
    return `A pie chart needs 2 to ${PIE_MAX_ROWS} slices.`;
  }
  if (view.kind === "kpi" && rowCount !== 1) {
    return "A KPI shows a single row.";
  }
  if (view.kind === "chart" && [...view.y, view.groupBy].includes(view.x)) {
    return "A chart cannot plot its x column as a series.";
  }
  return null;
};

export const checkCardAgainstResult = (
  spec: CardSpec,
  stats: ColumnStats[],
  rowCount: number
): string | null => {
  const byName = new Map(stats.map((column) => [column.name, column]));
  const referenced = [
    ...referencedColumns(spec.view),
    ...Object.keys(spec.formats),
  ];
  const missing = referenced.find((name) => !byName.has(name));
  if (missing) {
    return `Column ${missing} is not in the result.`;
  }
  const notNumeric = numericColumns(spec.view).find(
    (name) => byName.get(name)?.kind !== "numeric"
  );
  if (notNumeric) {
    return `Column ${notNumeric} is not numeric.`;
  }
  return shapeProblem(spec.view, rowCount);
};
