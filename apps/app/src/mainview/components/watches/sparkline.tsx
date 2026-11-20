import { motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { DRAW, useMotionPreset } from "@/lib/motion";

export const SPARK_WIDTH = 48;
export const SPARK_HEIGHT = 14;
const PAD = 2;

const drawn = new Set<string>();

export const resetDrawnSparklines = () => drawn.clear();

interface Point {
  x: number;
  y: number;
}

export const sparkPoints = (values: readonly number[]): Point[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step =
    values.length > 1 ? (SPARK_WIDTH - PAD * 2) / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: PAD + index * step,
    y:
      span === 0
        ? SPARK_HEIGHT / 2
        : PAD + (1 - (value - min) / span) * (SPARK_HEIGHT - PAD * 2),
  }));
};

const pathOf = (points: readonly Point[]): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");

interface SparklineProps {
  values: readonly number[];
  seriesKey: string;
  sampleKey: string;
}

// The chip beside it carries the meaning, so the line stays hidden from AT.
export function Sparkline({ values, seriesKey, sampleKey }: SparklineProps) {
  const { reduced, soft, fadeIn } = useMotionPreset();
  const [scope, animate] = useAnimate<SVGGElement>();
  const [drawIn] = useState(() => !(reduced || drawn.has(seriesKey)));
  const shownSample = useRef(sampleKey);
  const points = sparkPoints(values);
  const last = points.at(-1);
  const step =
    points.length > 1 ? (points[1]?.x ?? 0) - (points[0]?.x ?? 0) : 0;

  useEffect(() => {
    drawn.add(seriesKey);
  }, [seriesKey]);

  useEffect(() => {
    if (shownSample.current === sampleKey) {
      return;
    }
    shownSample.current = sampleKey;
    if (reduced || !scope.current) {
      return;
    }
    const controls = animate(scope.current, { x: [step, 0] }, soft);
    return () => controls.stop();
  }, [animate, reduced, sampleKey, scope, soft, step]);

  return (
    <svg
      aria-hidden
      className="shrink-0 overflow-visible text-panel-muted"
      data-motion={drawIn ? "draw" : "static"}
      data-testid="sparkline"
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      width={SPARK_WIDTH}
    >
      <g ref={scope}>
        <motion.path
          animate={{ pathLength: 1 }}
          d={pathOf(points)}
          fill="none"
          initial={{ pathLength: drawIn ? 0 : 1 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.25}
          transition={drawIn ? DRAW : { duration: 0 }}
        />
        {last ? (
          <motion.circle
            animate={{ opacity: 1 }}
            cx={last.x}
            cy={last.y}
            fill="currentColor"
            initial={{ opacity: reduced ? 1 : 0 }}
            key={sampleKey}
            r={1}
            transition={fadeIn}
          />
        ) : null}
      </g>
    </svg>
  );
}
