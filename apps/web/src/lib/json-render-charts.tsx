import type { BaseComponentProps } from "@json-render/react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const clampData = <T,>(
  data: readonly T[]
): { points: T[]; truncated: boolean; total: number } => {
  const total = data.length;
  if (total <= MAX_CHART_POINTS) {
    return { points: [...data], total, truncated: false };
  }
  return {
    points: data.slice(0, MAX_CHART_POINTS),
    total,
    truncated: true,
  };
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
  <figure
    className={cn(
      "space-y-2 rounded-lg border bg-card/40 p-3 text-card-foreground",
      className
    )}
  >
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

const ChartEmpty = ({ message }: { message: string }) => (
  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-background/40 text-xs text-muted-foreground">
    {message}
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
  dropped: string[]
): string | null => {
  const parts: string[] = [];
  if (total > MAX_CHART_POINTS) {
    parts.push(`Showing first ${MAX_CHART_POINTS} of ${total} points.`);
  }
  if (dropped.length > 0) {
    parts.push(`Skipped non-numeric series: ${dropped.join(", ")}.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
};

const ChartBarRenderer = ({ props }: BaseComponentProps<ChartBarProps>) => {
  const { data, xKey, series, title, description, layout, stacked } = props;

  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    !Array.isArray(series) ||
    series.length === 0 ||
    typeof xKey !== "string" ||
    xKey.length === 0
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmpty message="No data to visualize" />
      </ChartFrame>
    );
  }

  const { points, total } = clampData(data);
  const { usable, dropped } = normalizeSeries(series, points);

  if (usable.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmpty message="No numeric series found in data" />
      </ChartFrame>
    );
  }

  const coerced = coerceRows(
    points,
    usable.map((s) => s.key)
  );
  const config = buildConfig(usable);
  const isVertical = layout === "vertical";
  const note = buildTruncationNote(total, dropped);

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
              <XAxis axisLine={false} tickLine={false} type="number" />
              <YAxis
                axisLine={false}
                dataKey={xKey}
                tickLine={false}
                type="category"
              />
            </>
          ) : (
            <>
              <XAxis axisLine={false} dataKey={xKey} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
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
    !Array.isArray(data) ||
    data.length === 0 ||
    !Array.isArray(series) ||
    series.length === 0 ||
    typeof xKey !== "string" ||
    xKey.length === 0
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmpty message="No data to visualize" />
      </ChartFrame>
    );
  }

  const { points, total } = clampData(data);
  const { usable, dropped } = normalizeSeries(series, points);

  if (usable.length === 0) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmpty message="No numeric series found in data" />
      </ChartFrame>
    );
  }

  const coerced = coerceRows(
    points,
    usable.map((s) => s.key)
  );
  const config = buildConfig(usable);
  const note = buildTruncationNote(total, dropped);

  return (
    <ChartFrame description={description} footnote={note} title={title}>
      <ChartContainer className="h-64 w-full" config={config}>
        <LineChart
          accessibilityLayer
          data={coerced}
          margin={{ bottom: 8, left: 8, right: 8, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey={xKey} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {usable.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {usable.map((s) => (
            <Line
              dataKey={s.key}
              dot={false}
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

const ChartPieRenderer = ({ props }: BaseComponentProps<ChartPieProps>) => {
  const { data, nameKey, valueKey, title, description, donut } = props;

  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    typeof nameKey !== "string" ||
    typeof valueKey !== "string"
  ) {
    return (
      <ChartFrame description={description} title={title}>
        <ChartEmpty message="No data to visualize" />
      </ChartFrame>
    );
  }

  const { points, total } = clampData(data);

  const cleaned = points.flatMap((row) => {
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
        <ChartEmpty message="No numeric values to plot" />
      </ChartFrame>
    );
  }

  const config: ChartConfig = {};
  for (let i = 0; i < cleaned.length; i += 1) {
    const slice = cleaned[i];
    if (!slice) {
      continue;
    }
    config[slice.name] = {
      color: pickColor(i),
      label: slice.name,
    };
  }

  const note =
    total > MAX_CHART_POINTS
      ? `Showing first ${MAX_CHART_POINTS} of ${total} slices.`
      : null;

  return (
    <ChartFrame description={description} footnote={note} title={title}>
      <ChartContainer className="h-64 w-full" config={config}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={cleaned}
            dataKey="value"
            innerRadius={donut ? 60 : 0}
            nameKey="name"
            outerRadius={90}
            strokeWidth={1}
          >
            {cleaned.map((slice) => (
              <Cell fill={`var(--color-${slice.name})`} key={slice.name} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
    </ChartFrame>
  );
};

const formatKpiValue = (
  value: string | number,
  format: ChartKpiProps["format"],
  currency: string | null | undefined
): string => {
  if (typeof value === "string") {
    return value;
  }
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

const ChartKpiRenderer = ({ props }: BaseComponentProps<ChartKpiProps>) => {
  const { label, value, description, format, delta, deltaLabel, currency } =
    props;

  const displayValue = formatKpiValue(value, format, currency);
  const deltaSign = typeof delta === "number" && delta !== 0 ? delta > 0 : null;
  let deltaClass = "text-muted-foreground";
  if (deltaSign === true) {
    deltaClass = "text-emerald-500";
  } else if (deltaSign === false) {
    deltaClass = "text-destructive";
  }

  return (
    <figure className="flex flex-col gap-1 rounded-lg border bg-card/40 p-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-data text-3xl font-semibold text-foreground">
        {displayValue}
      </span>
      {typeof delta === "number" ? (
        <span className={cn("text-xs font-medium", deltaClass)}>
          {delta > 0 ? "+" : ""}
          {formatKpiValue(delta, format, currency)}
          {deltaLabel ? (
            <span className="ml-1 text-muted-foreground">{deltaLabel}</span>
          ) : null}
        </span>
      ) : null}
      {description ? (
        <span className="text-xs text-muted-foreground">{description}</span>
      ) : null}
    </figure>
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
