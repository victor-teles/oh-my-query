import { AnimatePresence, motion } from "motion/react";

import type { ChartModel } from "@/lib/card-data";

import { SwapText } from "@/components/motion/swap-text";
import { formatValue, latestValues } from "@/lib/card-data";
import { staggerDelay, useMotionPreset } from "@/lib/motion";

interface CardLegendProps {
  model: ChartModel;
}

export function CardLegend({ model }: CardLegendProps) {
  const { reduced, spring, fadeIn, fadeOut } = useMotionPreset();
  const latest = latestValues(model.data);

  return (
    <ul
      aria-label={model.showsLatest ? "Latest values" : "Series"}
      className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2"
    >
      <AnimatePresence mode="popLayout">
        {model.data.series.map((series, index) => (
          <motion.li
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 type-meta"
            exit={{ opacity: 0, transition: fadeOut }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
            key={series.label}
            layout={reduced ? false : "position"}
            transition={{
              ...fadeIn,
              delay: reduced ? 0 : staggerDelay(index),
              layout: spring,
            }}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-panel-muted">{series.label}</span>
            {model.showsLatest ? (
              <SwapText
                className="text-foreground tabular-nums"
                value={formatValue(
                  latest.get(series.key),
                  model.yFormat,
                  model.context
                )}
              />
            ) : null}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
