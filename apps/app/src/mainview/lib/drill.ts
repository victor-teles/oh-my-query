import { redactPii } from "@conch/core/client";

import type {
  CardResult,
  CardViewKind,
  ChartModel,
  ChartRow,
} from "@/lib/card-data";
import type { CardSpec, CardView, ChartView } from "@/lib/ipc";

import {
  alternatesFor,
  chartModelOf,
  formatFor,
  formatValue,
  isNumericColumn,
  OTHER_LABEL,
  pieModelOf,
  X_KEY,
} from "@/lib/card-data";

type PieView = Extract<CardView, { kind: "pie" }>;

export interface DrillFilter {
  column: string;
  value: string | number;
}

export interface DrillSegment {
  filters: DrillFilter[];
}

export const MAX_DRILL_SEGMENTS = 50;
const MAX_ROW_FILTERS = 2;
const EMPTY_LABEL = "—";

const isUsable = (value: unknown): value is string | number => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value !== OTHER_LABEL &&
    value !== EMPTY_LABEL
  );
};

export const segmentOfBar = (
  view: ChartView,
  model: ChartModel,
  row: ChartRow,
  seriesKey: string | null
): DrillSegment | null => {
  const x = row[X_KEY];
  if (!isUsable(x)) {
    return null;
  }
  const xFilter = { column: view.x, value: x };
  const series = model.data.series.find((item) => item.key === seriesKey);
  if (!(view.groupBy && series)) {
    return { filters: [xFilter] };
  }
  return isUsable(series.label)
    ? { filters: [{ column: view.groupBy, value: series.label }, xFilter] }
    : null;
};

export const segmentOfSlice = (
  view: PieView,
  label: string
): DrillSegment | null =>
  isUsable(label) ? { filters: [{ column: view.label, value: label }] } : null;

export const segmentOfRow = (
  result: CardResult,
  rowIndex: number,
  columns?: readonly string[]
): DrillSegment | null => {
  const row = result.rows[rowIndex];
  if (!row) {
    return null;
  }
  const filters = result.columns
    .map((column, index) => ({ column: column.name, value: row[index] }))
    .filter(
      (cell): cell is DrillFilter =>
        (!columns || columns.includes(cell.column)) &&
        !isNumericColumn(result, cell.column) &&
        isUsable(cell.value)
    )
    .slice(0, MAX_ROW_FILTERS);
  return filters.length > 0 ? { filters } : null;
};

const displayOf = (filter: DrillFilter, formats: CardSpec["formats"]) =>
  formatValue(
    filter.value,
    formatFor({ formats }, filter.column, [filter.value])
  );

export const segmentLabel = (
  segment: DrillSegment,
  formats: CardSpec["formats"]
): string =>
  segment.filters.map((filter) => displayOf(filter, formats)).join(" · ");

export const drillPrompt = (
  segment: DrillSegment,
  formats: CardSpec["formats"]
): string =>
  `break down ${segment.filters
    .map((filter) => `${filter.column} "${displayOf(filter, formats)}"`)
    .join(", ")}`;

export const segmentId = (segment: DrillSegment): string =>
  segment.filters
    .map((filter) => `${filter.column}=${String(filter.value)}`)
    .join("&");

export const isRedacted = (
  segment: DrillSegment,
  customPatterns: readonly string[]
): boolean =>
  segment.filters.some((filter) => {
    const text = String(filter.value);
    return redactPii(text, { customPatterns }).text !== text;
  });

const chartSegments = (
  view: ChartView,
  result: CardResult,
  spec: CardSpec
): (DrillSegment | null)[] => {
  const model = chartModelOf(view, result, spec.formats);
  const keys = view.groupBy
    ? model.data.series.map((series) => series.key)
    : [null];
  return model.data.rows.flatMap((row) =>
    keys.map((key) => segmentOfBar(view, model, row, key))
  );
};

const segmentsFor = (
  view: CardView,
  result: CardResult,
  spec: CardSpec
): (DrillSegment | null)[] => {
  switch (view.kind) {
    case "chart": {
      return chartSegments(view, result, spec);
    }
    case "pie": {
      return pieModelOf(view, result, spec.formats).data.series.map((series) =>
        segmentOfSlice(view, series.label)
      );
    }
    case "table": {
      return result.rows.map((_, index) =>
        segmentOfRow(result, index, view.columns)
      );
    }
    default: {
      return [];
    }
  }
};

export const drillSegments = (
  spec: CardSpec,
  result: CardResult,
  viewKind: CardViewKind
): DrillSegment[] => {
  const option = alternatesFor(spec, result).find(
    (item) => item.kind === viewKind
  );
  if (!option) {
    return [];
  }
  const unique = new Map<string, DrillSegment>();
  for (const segment of segmentsFor(option.view, result, spec)) {
    if (segment && !unique.has(segmentId(segment))) {
      unique.set(segmentId(segment), segment);
    }
  }
  return [...unique.values()].slice(0, MAX_DRILL_SEGMENTS);
};
