import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";
import type { ChartModel } from "@/lib/card-data";
import type { CardView } from "@/lib/ipc";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { segmentOfSlice } from "@/lib/drill";

import type { ChartAnimation } from "./card-chart";

import { CARD_CHART_HEIGHT } from "./ask-skeleton";
import { animationTiming } from "./card-chart";
import { CardTooltip } from "./card-tooltip";
import { useDrillTarget } from "./drill-context";

const PIE_SWEEP_MS = 450;
const DIMMED = 0.5;

type PieView = Extract<CardView, { kind: "pie" }>;

const usePieDrill = (view: PieView, model: ChartModel) => {
  const target = useDrillTarget();
  const [hovered, setHovered] = useState<number | null>(null);
  if (!target) {
    return null;
  }
  return {
    onClick: (_: unknown, index: number) => {
      const series = model.data.series[index];
      const segment = series ? segmentOfSlice(view, series.label) : null;
      if (segment && !target.isHidden(segment)) {
        target.drill(segment);
      }
    },
    onMouseEnter: (_: unknown, index: number) => setHovered(index),
    onMouseLeave: () => setHovered(null),
    opacityOf: (index: number) =>
      hovered !== null && hovered !== index ? DIMMED : 1,
  };
};

interface CardPieProps {
  view: PieView;
  model: ChartModel;
  label: string;
  animation: ChartAnimation;
}

export function CardPie({ view, model, label, animation }: CardPieProps) {
  const drill = usePieDrill(view, model);
  const [row] = model.data.rows;
  const slices = model.data.series.map((series) => ({
    color: series.color,
    key: series.key,
    value: row?.[series.key] ?? 0,
  }));
  const config: ChartConfig = Object.fromEntries(
    model.data.series.map((series) => [
      series.key,
      { color: series.color, label: series.label },
    ])
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
        config={config}
        style={{ height: CARD_CHART_HEIGHT }}
      >
        <PieChart>
          <ChartTooltip
            content={<CardTooltip model={model} />}
            isAnimationActive={false}
          />
          <Pie
            {...animationTiming(animation, PIE_SWEEP_MS)}
            animationEasing="ease-out"
            data={slices}
            dataKey="value"
            innerRadius={56}
            nameKey="key"
            outerRadius={88}
            paddingAngle={1.5}
            stroke="var(--panel-solid)"
            onClick={drill?.onClick}
            onMouseEnter={drill?.onMouseEnter}
            onMouseLeave={drill?.onMouseLeave}
          >
            {slices.map((slice, index) => (
              <Cell
                fill={slice.color}
                fillOpacity={drill?.opacityOf(index) ?? 1}
                key={slice.key}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </figure>
  );
}
