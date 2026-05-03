import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { IslandCancelButton } from "./island-cancel-button";
import {
  INDICATOR_DOT_STAGGER_S,
  INDICATOR_LOOP_TRANSITION,
  STREAM_BAR_HEIGHTS,
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
      <div
        aria-hidden="true"
        className="flex items-end gap-px"
        style={{ height: BAR_HEIGHT_PX }}
      >
        {BAR_IDS.map((id, i) => (
          <motion.span
            animate={
              shouldReduceMotion
                ? undefined
                : { scaleY: [STREAM_BAR_HEIGHTS[i], 1] }
            }
            className="w-0.5 origin-bottom rounded-full bg-muted-foreground"
            key={id}
            style={{ height: BAR_HEIGHT_PX }}
            transition={INDICATOR_LOOP_TRANSITION(i * INDICATOR_DOT_STAGGER_S)}
          />
        ))}
      </div>
      <span className="sr-only">Streaming AI response</span>
      <span aria-hidden="true" className={cn(`
            flex items-baseline gap-1 text-xs font-medium tracking-tight
            text-muted-foreground
          `, shouldReduceMotion && "font-semibold")}>
        <span>Streaming</span>
        {tokensReceived > 0 && (
          <span className="text-muted-foreground/50 tabular-nums">
            · {tokensReceived} {tokensReceived === 1 ? "token" : "tokens"}
          </span>
        )}
      </span>
      {onCancel && (
        <IslandCancelButton label="Stop generating" onCancel={onCancel} />
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
        animate={shouldReduceMotion ? undefined : { scale: [0.6, 1] }}
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
        transition={INDICATOR_LOOP_TRANSITION()}
      />
      <span className="sr-only">AI planning query</span>
      <span
        aria-hidden="true"
        className={cn(
          "text-xs font-medium tracking-tight text-muted-foreground",
          shouldReduceMotion && "font-semibold"
        )}
      >
        Planning…
      </span>
      {onCancel && (
        <IslandCancelButton label="Stop planning" onCancel={onCancel} />
      )}
    </>
  );
};
