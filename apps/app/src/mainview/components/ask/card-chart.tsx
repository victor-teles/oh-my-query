import type { ReactElement } from "react";

import { formatTick } from "@oh-my-query/rpc";
import { useCallback } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import type { ChartModel } from "@/lib/card-data";
import type { ChartView } from "@/lib/ipc";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { X_KEY } from "@/lib/card-data";

import type { ChartDrill } from "./use-chart-drill";

import { CARD_CHART_HEIGHT } from "./ask-skeleton";
import { CardTooltip } from "./card-tooltip";
import { useChartDrill } from "./use-chart-drill";

export type ChartAnimation = "intro" | "update" | "none";

const LINE_DRAW_MS = 450;
const BAR_GROW_MS = 200;
const BAR_STAGGER_MS = 12;
export const DATA_UPDATE_MS = 300;

export const animationTiming = (
  animation: ChartAnimation,
  introMs: number
) => ({
  animationDuration: animation === "update" ? DATA_UPDATE_MS : introMs,
  isAnimationActive: animation !== "none",
});
const MARGIN = { bottom: 0, left: 4, right: 8, top: 8 };

interface CardChartProps {
  view: ChartView;
  model: ChartModel;
  label: string;
  animation: ChartAnimation;
}

const configOf = (model: ChartModel): ChartConfig =>
  Object.fromEntries(
    model.data.series.map((series) => [
      series.key,
      { color: series.color, label: series.label },
    ])
  );

interface TickFormatters {
  x: (value: unknown) => string;
  y: (value: unknown) => string;
}

const axes = (model: ChartModel, ticks: TickFormatters) => [
  <CartesianGrid
    className="text-foreground"
    key="grid"
    stroke="currentColor"
    strokeOpacity={0.07}
    vertical={false}
  />,
  <XAxis
    axisLine={false}
    dataKey={X_KEY}
    interval="preserveStartEnd"
    key="x"
    minTickGap={20}
    tickFormatter={ticks.x}
    tickLine={false}
    tickMargin={8}
  />,
  <YAxis
    axisLine={false}
    key="y"
    tickCount={4}
    tickFormatter={ticks.y}
    tickLine={false}
    width={48}
  />,
  <ChartTooltip
    content={<CardTooltip model={model} />}
    cursor={{ fill: "var(--row-hover)", stroke: "var(--panel-border)" }}
    isAnimationActive={false}
    key="tooltip"
  />,
];

const renderChart = (
  view: ChartView,
  model: ChartModel,
  ticks: TickFormatters,
  animation: ChartAnimation,
  drill: ChartDrill | null
): ReactElement => {
  const { rows, series } = model.data;
  const stackId = view.stacked ? "stack" : undefined;
  switch (view.mark) {
    case "line": {
      return (
        <LineChart
          accessibilityLayer
          data={rows}
          margin={MARGIN}
          onClick={drill?.onChartClick}
        >
          {axes(model, ticks)}
          {series.map((item) => (
            <Line
              {...animationTiming(animation, LINE_DRAW_MS)}
              animationEasing="ease-out"
              dataKey={item.key}
              dot={false}
              key={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      );
    }
    case "area": {
      return (
        <AreaChart
          accessibilityLayer
          data={rows}
          margin={MARGIN}
          onClick={drill?.onChartClick}
        >
          {axes(model, ticks)}
          {series.map((item) => (
            <Area
              {...animationTiming(animation, LINE_DRAW_MS)}
              animationEasing="ease-out"
              dataKey={item.key}
              fill={item.color}
              fillOpacity={0.16}
              key={item.key}
              name={item.label}
              stackId={stackId}
              stroke={item.color}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </AreaChart>
      );
    }
    default: {
      return (
        <BarChart accessibilityLayer data={rows} margin={MARGIN}>
          {axes(model, ticks)}
          {series.map((item, index) => (
            <Bar
              {...animationTiming(animation, BAR_GROW_MS)}
              animationBegin={
                animation === "intro" ? index * BAR_STAGGER_MS : 0
              }
              animationEasing="ease-out"
              dataKey={item.key}
              fill={item.color}
              key={item.key}
              name={item.label}
              radius={view.stacked ? 0 : [3, 3, 0, 0]}
              stackId={stackId}
              {...drill?.barEvents(item.key)}
            >
              {drill
                ? rows.map((row, rowIndex) => (
                    <Cell
                      fillOpacity={drill.opacityOf(item.key, rowIndex)}
                      key={String(row[X_KEY])}
                    />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      );
    }
  }
};

export function CardChart({ view, model, label, animation }: CardChartProps) {
  const { xFormat, yFormat, context } = model;
  const drill = useChartDrill(view, model);
  const x = useCallback(
    (value: unknown) => formatTick(value, xFormat),
    [xFormat]
  );
  const y = useCallback(
    (value: unknown) => formatTick(value, yFormat, context),
    [context, yFormat]
  );
  return (
    <figure
      aria-label={label}
      className="px-2"
      data-drill={drill ? "" : undefined}
      role="img"
    >
      <ChartContainer
        className="aspect-auto w-full"
        config={configOf(model)}
        style={{ height: CARD_CHART_HEIGHT }}
      >
        {renderChart(view, model, { x, y }, animation, drill)}
      </ChartContainer>
    </figure>
  );
}
