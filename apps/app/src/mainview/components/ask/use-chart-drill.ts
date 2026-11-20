import { useState } from "react";

import type { ChartModel } from "@/lib/card-data";
import type { DrillSegment } from "@/lib/drill";
import type { ChartView } from "@/lib/ipc";

import { segmentOfBar } from "@/lib/drill";

import { useDrillTarget } from "./drill-context";

const DIMMED = 0.5;

interface Hovered {
  key: string;
  index: number;
}

interface ChartPointer {
  activeTooltipIndex?: number;
}

export const useChartDrill = (view: ChartView, model: ChartModel) => {
  const target = useDrillTarget();
  const [hovered, setHovered] = useState<Hovered | null>(null);
  if (!target) {
    return null;
  }
  const run = (segment: DrillSegment | null) => {
    if (segment && !target.isHidden(segment)) {
      target.drill(segment);
    }
  };
  const segmentAt = (index: number, key: string | null) => {
    const row = model.data.rows[index];
    return row ? segmentOfBar(view, model, row, key) : null;
  };
  return {
    barEvents: (key: string) => ({
      onClick: (_: unknown, index: number) => run(segmentAt(index, key)),
      onMouseEnter: (_: unknown, index: number) => setHovered({ index, key }),
      onMouseLeave: () => setHovered(null),
    }),
    onChartClick: (state: ChartPointer | null) => {
      const index = state?.activeTooltipIndex;
      if (index !== undefined) {
        run(segmentAt(index, null));
      }
    },
    opacityOf: (key: string, index: number): number =>
      hovered?.key === key && hovered.index !== index ? DIMMED : 1,
  };
};

export type ChartDrill = NonNullable<ReturnType<typeof useChartDrill>>;
