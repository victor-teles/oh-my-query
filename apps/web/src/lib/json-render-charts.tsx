import type { BaseComponentProps } from "@json-render/react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const MAX_CHART_POINTS = 500;

const DEFAULT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const pickColor = (index: number, override?: string | null): string =>
  override && override.length > 0
    ? override
    : (DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] ?? "var(--chart-1)");

const seriesSchema = z.array(
  z.object({
    color: z.string().nullish(),
    key: z.string(),
    label: z.string().nullish(),
  })
);

const dataSchema = z.array(z.record(z.string(), z.unknown()));
const pieDataSchema = z.array(z.record(z.string(), z.unknown()));

const chartBarProps = z.object({
  data: dataSchema,
  description: z.string().nullish(),
  layout: z.enum(["vertical", "horizontal"]).nullish(),
  series: seriesSchema,
  stacked: z.boolean().nullish(),
  title: z.string().nullish(),
  xKey: z.string(),
});

const chartLineProps = z.object({
  data: dataSchema,
  description: z.string().nullish(),
  series: seriesSchema,
  smooth: z.boolean().nullish(),
  title: z.string().nullish(),
  xKey: z.string(),
});

const chartPieProps = z.object({
  data: pieDataSchema,
  description: z.string().nullish(),
  donut: z.boolean().nullish(),
  nameKey: z.string(),
  title: z.string().nullish(),
  valueKey: z.string(),
});

const chartKpiProps = z.object({
  currency: z.string().nullish(),
  delta: z.number().nullish(),
  deltaFormat: z.enum(["number", "currency", "percent"]).nullish(),
  deltaLabel: z.string().nullish(),
  description: z.string().nullish(),
  format: z.enum(["number", "currency", "percent"]).nullish(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

export type ChartBarPropsInput = z.input<typeof chartBarProps>;
export type ChartLinePropsInput = z.input<typeof chartLineProps>;
export type ChartPiePropsInput = z.input<typeof chartPieProps>;
export type ChartKpiPropsInput = z.input<typeof chartKpiProps>;

type ChartBarProps = z.output<typeof chartBarProps>;
type ChartLineProps = z.output<typeof chartLineProps>;
type ChartPieProps = z.output<typeof chartPieProps>;
type ChartKpiProps = z.output<typeof chartKpiProps>;

const sampleSeries = <T,>(
  points: readonly T[],
  max: number
): { sampled: T[]; downsampled: boolean } => {
  const n = points.length;
  if (n <= max) {
    return { downsampled: false, sampled: [...points] };
  }
  const sampled: T[] = [];
  const stride = (n - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    const idx = Math.min(n - 1, Math.round(i * stride));
    const point = points[idx];
    if (point !== undefined) {
      sampled.push(point);
    }
  }
  return { downsampled: true, sampled };
};

const coerceNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildConfig = (
  series: readonly {
    key: string;
    label?: string | null;
    color?: string | null;
  }[]
): ChartConfig => {
  const config: ChartConfig = {};
  for (let i = 0; i < series.length; i += 1) {
    const item = series[i];
    if (!item) {
      continue;
    }
    config[item.key] = {
      color: pickColor(i, item.color),
      label: item.label ?? item.key,
    };
  }
  return config;
};

const ChartFrame = ({
  title,
  description,
  footnote,
  className,
  children,
}: {
  title?: string | null;
  description?: string | null;
  footnote?: string | null;
  className?: string;
  children: React.ReactNode;
}) => (
  <figure className={cn("space-y-2 tabular-nums", className)}>
    {(title || description) && (
      <figcaption className="space-y-0.5">
        {title ? (
          <div className="text-sm font-medium text-foreground">{title}</div>
        ) : null}
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </figcaption>
    )}
    {children}
    {footnote ? (
      <p className="text-[10px] text-muted-foreground">{footnote}</p>
    ) : null}
  </figure>
);

type EmptyStateReason =
  | "no-data"
  | "no-numeric-series"
  | "no-numeric-values"
  | "missing-config";

const EMPTY_STATE_COPY: Record<EmptyStateReason, string> = {
  "missing-config":
    "Add a data array, an xKey, and at least one series to render this chart.",
  "no-data":
    "No rows to chart yet — run the query above, or pass a literal data array.",
  "no-numeric-series":
    "None of the selected columns are numeric. Try count, avg, or a cast.",
  "no-numeric-values":
    "None of the rows had a numeric value to slice. Try aggregating first.",
};

const ChartEmptyState = ({ reason }: { reason: EmptyStateReason }) => (
  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-background/40 px-4 text-center text-xs text-muted-foreground">
    {EMPTY_STATE_COPY[reason]}
  </div>
);

const normalizeSeries = (
  series: ChartBarProps["series"],
  points: readonly Record<string, unknown>[]
) => {
  const usable: typeof series = [];
  const dropped: string[] = [];
  for (const s of series) {
    const hasAnyNumeric = points.some(
      (row) => coerceNumber(row[s.key]) !== null
    );
    if (hasAnyNumeric) {
      usable.push(s);
    } else {
      dropped.push(s.key);
    }
  }
  return { dropped, usable };
};

const coerceRows = (
  rows: readonly Record<string, unknown>[],
  seriesKeys: readonly string[]
): Record<string, unknown>[] =>
  rows.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const key of seriesKeys) {
      next[key] = coerceNumber(row[key]);
    }
    return next;
  });

const buildTruncationNote = (
  total: number,
  kept: number,
  downsampled: boolean,
  dropped: string[]
): string | null => {
  const parts: string[] = [];
  if (downsampled) {
    parts.push(
      `Downsampled to ${kept} of ${total} points to keep the shape readable.`
    );
  }
  if (dropped.length > 0) {
    parts.push(`Skipped non-numeric series: ${dropped.join(", ")}.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
};

const formatNumeric = (
  value: number,
  format: ChartKpiProps["format"] | ChartKpiProps["deltaFormat"],
  currency: string | null | undefined
): string => {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (format === "currency") {
    try {
      return new Intl.NumberFormat(undefined, {
        currency: currency || "USD",
        style: "currency",
      }).format(value);
    } catch {
      return value.toLocaleString();
    }
  }
  if (format === "percent") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toLocaleString();
};

const formatKpiValue = (
  value: string | number,
  format: ChartKpiProps["format"],
  currency: string | null | undefined
): string => {
  if (typeof value === "string") {
    return value;
  }
  return formatNumeric(value, format, currency);
};

const ChartBarRenderer = ({ props }: BaseComponentProps<ChartBarProps>) => {
  const { data, xKey, series, title, description, layout, stacked } = props;

  if (
    !Array.isArray(series) ||
    series.length === 0 ||
    typeof xKey !== "string" ||
    xKey.length === 0
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="missing-config" />
      </ChartFrame>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-data" />
      </ChartFrame>
    );
  }

  const { sampled: points, downsampled } = sampleSeries(data, MAX_CHART_POINTS);
  const { usable, dropped } = normalizeSeries(series, points);

  if (usable.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-numeric-series" />
      </ChartFrame>
    );
  }

  const coerced = coerceRows(
    points,
    usable.map((s) => s.key)
  );
  const config = buildConfig(usable);
  const isVertical = layout === "vertical";
  const note = buildTruncationNote(
    data.length,
    points.length,
    downsampled,
    dropped
  );

  return (
    <ChartFrame description={description} footnote={note} title={title}>
      <ChartContainer className="h-64 w-full" config={config}>
        <BarChart
          accessibilityLayer
          data={coerced}
          layout={isVertical ? "vertical" : "horizontal"}
          margin={{ bottom: 8, left: 8, right: 8, top: 8 }}
        >
          <CartesianGrid horizontal={!isVertical} vertical={isVertical} />
          {isVertical ? (
            <>
              <XAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey={xKey}
                tickLine={false}
                tickMargin={8}
                type="category"
                width={72}
              />
            </>
          ) : (
            <>
              <XAxis
                axisLine={false}
                dataKey={xKey}
                interval="preserveStartEnd"
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={36}
              />
            </>
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          {usable.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {usable.map((s) => (
            <Bar
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              isAnimationActive={false}
              key={s.key}
              radius={4}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  );
};

const ChartLineRenderer = ({ props }: BaseComponentProps<ChartLineProps>) => {
  const { data, xKey, series, title, description, smooth } = props;

  if (
    !Array.isArray(series) ||
    series.length === 0 ||
    typeof xKey !== "string" ||
    xKey.length === 0
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="missing-config" />
      </ChartFrame>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-data" />
      </ChartFrame>
    );
  }

  const { sampled: points, downsampled } = sampleSeries(data, MAX_CHART_POINTS);
  const { usable, dropped } = normalizeSeries(series, points);

  if (usable.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-numeric-series" />
      </ChartFrame>
    );
  }

  const coerced = coerceRows(
    points,
    usable.map((s) => s.key)
  );
  const config = buildConfig(usable);
  const note = buildTruncationNote(
    data.length,
    points.length,
    downsampled,
    dropped
  );

  return (
    <ChartFrame description={description} footnote={note} title={title}>
      <ChartContainer className="h-64 w-full" config={config}>
        <LineChart
          accessibilityLayer
          data={coerced}
          margin={{ bottom: 8, left: 8, right: 8, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey={xKey}
            interval="preserveStartEnd"
            minTickGap={24}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            domain={["auto", "auto"]}
            tickLine={false}
            tickMargin={8}
            width={36}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {usable.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {usable.map((s) => (
            <Line
              activeDot={{ r: 3 }}
              dataKey={s.key}
              dot={false}
              isAnimationActive={false}
              key={s.key}
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              type={smooth ? "monotone" : "linear"}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </ChartFrame>
  );
};

const PIE_MAX_SLICES = 8;

const ChartPieRenderer = ({ props }: BaseComponentProps<ChartPieProps>) => {
  const { data, nameKey, valueKey, title, description, donut } = props;

  if (
    typeof nameKey !== "string" ||
    nameKey.length === 0 ||
    typeof valueKey !== "string" ||
    valueKey.length === 0
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="missing-config" />
      </ChartFrame>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-data" />
      </ChartFrame>
    );
  }

  const cleaned = data.flatMap((row) => {
    const value = coerceNumber(row[valueKey]);
    const name = row[nameKey];
    if (value === null || name === null || name === undefined) {
      return [];
    }
    return [{ name: String(name), value }];
  });

  if (cleaned.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmptyState reason="no-numeric-values" />
      </ChartFrame>
    );
  }

  const displaySlices = cleaned.slice(0, PIE_MAX_SLICES);
  const truncated = cleaned.length > PIE_MAX_SLICES;
  const isDonut = donut !== false;
  const total = cleaned.reduce((sum, slice) => sum + slice.value, 0);

  const config: ChartConfig = {};
  for (let i = 0; i < displaySlices.length; i += 1) {
    const slice = displaySlices[i];
    if (!slice) {
      continue;
    }
    config[slice.name] = {
      color: pickColor(i),
      label: slice.name,
    };
  }

  const note = truncated
    ? `Showing top ${PIE_MAX_SLICES} of ${cleaned.length} slices — the rest are collapsed.`
    : null;

  return (
    <ChartFrame description={description} footnote={note} title={title}>
      <ChartContainer className="h-64 w-full" config={config}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie
            data={displaySlices}
            dataKey="value"
            innerRadius={isDonut ? "55%" : 0}
            isAnimationActive={false}
            nameKey="name"
            outerRadius="80%"
            stroke="var(--background)"
            strokeWidth={2}
          >
            {displaySlices.map((slice) => (
              <Cell
                aria-label={`${slice.name}: ${slice.value}`}
                fill={`var(--color-${slice.name})`}
                key={slice.name}
              />
            ))}
            {isDonut ? (
              <Label
                content={<PieCenterLabel total={total} />}
                position="center"
              />
            ) : null}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
    </ChartFrame>
  );
};

interface PieCenterLabelRenderProps {
  total: number;
  viewBox?: { cx?: number; cy?: number } | unknown;
}

const PieCenterLabel = ({ total, viewBox }: PieCenterLabelRenderProps) => {
  const vb = viewBox as { cx?: number; cy?: number } | undefined;
  const cx = vb?.cx;
  const cy = vb?.cy;
  if (cx === undefined || cy === undefined) {
    return null;
  }
  return (
    <text dominantBaseline="middle" textAnchor="middle" x={cx} y={cy}>
      <tspan
        className="fill-muted-foreground text-[10px] uppercase tracking-wide"
        x={cx}
        y={cy - 8}
      >
        Total
      </tspan>
      <tspan
        className="fill-foreground text-lg font-semibold"
        x={cx}
        y={cy + 10}
      >
        {total.toLocaleString()}
      </tspan>
    </text>
  );
};

const ChartKpiRenderer = ({ props }: BaseComponentProps<ChartKpiProps>) => {
  const {
    label,
    value,
    description,
    format,
    delta,
    deltaFormat,
    deltaLabel,
    currency,
  } = props;

  const displayValue = formatKpiValue(value, format, currency);
  const deltaSign = typeof delta === "number" && delta !== 0 ? delta > 0 : null;
  let deltaClass = "text-muted-foreground";
  if (deltaSign === true) {
    deltaClass = "text-(--color-success)";
  } else if (deltaSign === false) {
    deltaClass = "text-(--color-destructive)";
  }

  let deltaDirection: "increased" | "decreased" | null = null;
  if (deltaSign === true) {
    deltaDirection = "increased";
  } else if (deltaSign === false) {
    deltaDirection = "decreased";
  }
  const formattedDelta =
    typeof delta === "number"
      ? formatNumeric(delta, deltaFormat ?? format, currency)
      : null;
  const deltaAriaLabel =
    deltaDirection && formattedDelta
      ? `${deltaDirection} by ${formattedDelta}${deltaLabel ? ` ${deltaLabel}` : ""}`
      : undefined;
  let deltaArrow = "";
  if (deltaSign === true) {
    deltaArrow = "▲ ";
  } else if (deltaSign === false) {
    deltaArrow = "▼ ";
  }

  return (
    <ChartFrame>
      <div className="flex flex-col gap-1 tabular-nums">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-data font-semibold text-3xl text-foreground">
          {displayValue}
        </span>
        {formattedDelta ? (
          <span
            aria-label={deltaAriaLabel}
            className={cn("font-medium text-xs", deltaClass)}
          >
            <span aria-hidden>
              {deltaArrow}
              {delta && delta > 0 ? "+" : ""}
              {formattedDelta}
            </span>
            {deltaLabel ? (
              <span aria-hidden className="ml-1 text-muted-foreground">
                {deltaLabel}
              </span>
            ) : null}
          </span>
        ) : null}
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </ChartFrame>
  );
};

export const chartComponentDefinitions = {
  ChartBar: {
    description:
      "Bar chart for categorical comparisons. Requires data rows, xKey, and at least one numeric series.",
    example: {
      data: [
        { month: "Jan", queries: 186 },
        { month: "Feb", queries: 305 },
      ],
      series: [{ key: "queries", label: "Queries" }],
      xKey: "month",
    },
    props: chartBarProps,
  },
  ChartKpi: {
    description:
      "Single-metric summary card. Use for high-level numbers (counts, averages, rates).",
    example: { label: "Total rows", value: 1248 },
    props: chartKpiProps,
  },
  ChartLine: {
    description:
      "Line chart for trends across an ordered axis. Requires data rows, xKey, and at least one numeric series.",
    example: {
      data: [
        { latency: 45, time: "00:00" },
        { latency: 52, time: "06:00" },
      ],
      series: [{ key: "latency", label: "Latency (ms)" }],
      xKey: "time",
    },
    props: chartLineProps,
  },
  ChartPie: {
    description:
      "Pie/donut chart for part-of-whole relationships. Best for fewer than 8 slices.",
    example: {
      data: [
        { count: 42, status: "ok" },
        { count: 8, status: "error" },
      ],
      nameKey: "status",
      valueKey: "count",
    },
    props: chartPieProps,
  },
} as const;

export const chartComponents = {
  ChartBar: ChartBarRenderer,
  ChartKpi: ChartKpiRenderer,
  ChartLine: ChartLineRenderer,
  ChartPie: ChartPieRenderer,
} as const;

export type ChartComponentName = keyof typeof chartComponentDefinitions;
