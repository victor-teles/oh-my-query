import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import {
  ISLAND_ITEM_TRANSITION,
  ISLAND_ITEM_VARIANTS,
  PLAN_DOT_TRANSITION,
  STREAM_BAR_HEIGHTS,
  STREAM_BAR_TRANSITION,
} from "./island-motion";

const BAR_IDS = ["b1", "b2", "b3"] as const;

interface QueryStreamingStatusProps {
  tokensReceived: number;
}

export const QueryStreamingStatus = ({
  tokensReceived,
}: QueryStreamingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="flex items-end gap-px"
        style={{ height: 10 }}
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
            className="w-0.5 origin-bottom rounded-full bg-primary"
            initial={{ scaleY: STREAM_BAR_HEIGHTS[i] }}
            key={id}
            style={{ height: 10 }}
            transition={STREAM_BAR_TRANSITION(i)}
          />
        ))}
      </motion.div>
      <span className="sr-only">Streaming AI response</span>
      <motion.span
        className={cn(
          "text-chrome flex items-baseline gap-1 text-muted-foreground",
          shouldReduceMotion && "font-semibold"
        )}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        <span>Streaming</span>
        {tokensReceived > 0 && (
          <span className="text-muted-foreground/50">· {tokensReceived}</span>
        )}
      </motion.span>
    </>
  );
};

export const QueryPlanningStatus = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.span
        animate={shouldReduceMotion ? undefined : { scale: [0.5, 1, 0.5] }}
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-primary"
        initial={{ scale: 0.75 }}
        transition={PLAN_DOT_TRANSITION}
      />
      <span className="sr-only">AI planning query</span>
      <motion.span
        className={cn(
          "text-chrome text-muted-foreground",
          shouldReduceMotion && "font-semibold"
        )}
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        Planning…
      </motion.span>
    </>
  );
};

export const QueryCancelledStatus = () => (
  <>
    <motion.span
      aria-hidden="true"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      <X className="size-3 shrink-0 text-muted-foreground/60" />
    </motion.span>
    <span className="sr-only">Query cancelled</span>
    <motion.span
      aria-hidden="true"
      className="text-chrome text-muted-foreground/60"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      Cancelled
    </motion.span>
  </>
);
