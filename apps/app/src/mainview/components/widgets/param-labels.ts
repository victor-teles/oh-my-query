import type { DatePreset, IsoRange, RangePreset } from "@conch/core/client";

import { DATE_PRESETS, RANGE_PRESETS } from "@conch/core/client";
import { editableParams } from "@conch/rpc";

import type {
  ParamDef,
  ParamType,
  ParamValue,
  ParamValues,
  Widget,
} from "@/lib/ipc";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  last12m: "Last 12 months",
  last30d: "Last 30 days",
  last7d: "Last 7 days",
  lastMonth: "Last month",
  lastQuarter: "Last quarter",
  thisMonth: "This month",
  thisQuarter: "This quarter",
  ytd: "Year to date",
};

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  startOfMonth: "Start of month",
  startOfQuarter: "Start of quarter",
  startOfWeek: "Start of week",
  startOfYear: "Start of year",
  today: "Today",
  yesterday: "Yesterday",
};

export const PARAM_TYPE_LABELS: Record<ParamType, string> = {
  date: "Date",
  dateRange: "Date range",
  number: "Number",
  select: "Choice",
  text: "Text",
};

const DAY = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const utc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export const formatDay = (iso: string): string => DAY.format(utc(iso));

export const dayBefore = (iso: string): string => {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const dayAfter = (iso: string): string => {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export const formatRange = ({ from, to }: IsoRange): string => {
  const last = dayBefore(to);
  return last === from
    ? formatDay(from)
    : `${formatDay(from)} – ${formatDay(last)}`;
};

const isRangePreset = (value: unknown): value is RangePreset =>
  typeof value === "string" &&
  (RANGE_PRESETS as readonly string[]).includes(value);

const isDatePreset = (value: unknown): value is DatePreset =>
  typeof value === "string" &&
  (DATE_PRESETS as readonly string[]).includes(value);

const isRange = (value: ParamValue): value is IsoRange =>
  typeof value === "object" && value !== null;

export const formatParamValue = (
  param: ParamDef,
  value: ParamValue
): string => {
  switch (param.type) {
    case "dateRange": {
      if (isRangePreset(value)) {
        return RANGE_PRESET_LABELS[value];
      }
      return isRange(value) ? formatRange(value) : String(value);
    }
    case "date": {
      if (isDatePreset(value)) {
        return DATE_PRESET_LABELS[value];
      }
      return typeof value === "string" ? formatDay(value) : String(value);
    }
    case "number": {
      return typeof value === "number"
        ? value.toLocaleString("en-US")
        : String(value);
    }
    default: {
      return typeof value === "string" ? value : String(value);
    }
  }
};

export const currentValues = (widget: Widget): ParamValues =>
  Object.fromEntries(
    widget.params.map((param) => [
      param.name,
      widget.lastValues[param.name] ?? param.default,
    ])
  );

export const valuesSummary = (
  widget: Widget,
  values: ParamValues = currentValues(widget)
): string =>
  editableParams(widget.params)
    .map((param) =>
      formatParamValue(param, values[param.name] ?? param.default)
    )
    .join(" · ");
