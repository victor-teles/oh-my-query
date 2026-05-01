import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { IslandCancelButton } from "./island-cancel-button";
import {
  ISLAND_ITEM_TRANSITION,
  ISLAND_ITEM_VARIANTS,
  PLAN_DOT_TRANSITION,
  STREAM_BAR_HEIGHTS,
  STREAM_BAR_TRANSITION,
} from "./island-motion";

const BAR_IDS = ["b1", "b2", "b3"] as const;
const BAR_HEIGHT_PX = 10;

interface QueryStreamingStatusProps {
  tokensReceived: number;
  onCancel?: () => void;
}

export const QueryStreamingStatus = ({
  tokensReceived,
  onCancel,
}: QueryStreamingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="flex items-end gap-px"
        style={{ height: BAR_HEIGHT_PX }}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        {BAR_IDS.map((id, i) => (
          <motion.span
            animate={
              shouldReduceMotion
                ? undefined
                : { scaleY: [STREAM_BAR_HEIGHTS[i], 1, STREAM_BAR_HEIGHTS[i]] }
            }
            className="w-0.5 origin-bottom rounded-full bg-muted-foreground"
            initial={{ scaleY: STREAM_BAR_HEIGHTS[i] }}
            key={id}
            style={{ height: BAR_HEIGHT_PX }}
            transition={STREAM_BAR_TRANSITION(i)}
          />
        ))}
      </motion.div>
      <span className="sr-only">Streaming AI response</span>
      <motion.span
        className={cn(
          "text-xs font-medium tracking-tight flex items-baseline gap-1 text-muted-foreground",
          shouldReduceMotion && "font-semibold"
        )}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        <span>Streaming</span>
        {tokensReceived > 0 && (
          <span className="text-muted-foreground/50 tabular-nums">
            · {tokensReceived} tokens
          </span>
        )}
      </motion.span>
      {onCancel && (
        <IslandCancelButton onCancel={onCancel} label="Stop generating" />
      )}
    </>
  );
};

interface QueryPlanningStatusProps {
  onCancel?: () => void;
}

export const QueryPlanningStatus = ({ onCancel }: QueryPlanningStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.span
        animate={shouldReduceMotion ? undefined : { scale: [0.5, 1, 0.5] }}
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
        initial={{ scale: 0.75 }}
        transition={PLAN_DOT_TRANSITION}
      />
      <span className="sr-only">AI planning query</span>
      <motion.span
        className={cn(
          "text-muted-foreground text-xs font-medium tracking-tight",
          shouldReduceMotion && "font-semibold"
        )}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        Planning…
      </motion.span>
      {onCancel && (
        <IslandCancelButton onCancel={onCancel} label="Stop planning" />
      )}
    </>
  );
};
