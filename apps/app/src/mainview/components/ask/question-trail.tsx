import { ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { TrailCrumb } from "./ask-trail";

export const turnLayoutId = (index: number) => `ask-turn-${index}`;

interface CrumbProps {
  crumb: Extract<TrailCrumb, { kind: "turn" }>;
  shown: boolean;
  onStep: (index: number) => void;
}

function Crumb({ crumb, shown, onStep }: CrumbProps) {
  const { reduced, spring, snappy, fadeIn, fadeOut } = useMotionPreset();
  const { index } = crumb;
  const handleClick = useCallback(() => onStep(index), [index, onStep]);
  const label = (
    <motion.span
      className="relative block max-w-48 truncate"
      layoutCrossfade={false}
      layoutId={reduced ? undefined : turnLayoutId(crumb.index)}
      transition={spring}
    >
      {crumb.prompt}
    </motion.span>
  );
  if (crumb.pending) {
    return (
      <motion.span
        animate={{ opacity: 1 }}
        className="px-1.5 text-panel-muted"
        exit={{ opacity: 0, transition: fadeOut }}
        initial={{ opacity: reduced ? 1 : 0.6 }}
        transition={fadeIn}
      >
        {label}
      </motion.span>
    );
  }
  return (
    <Pressable
      aria-current={shown ? "step" : undefined}
      aria-label={`Show step ${crumb.index + 1}: ${crumb.prompt}`}
      className={cn(
        "relative rounded-[6px] px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        shown ? "text-foreground" : "text-panel-muted hover:text-foreground"
      )}
      onClick={handleClick}
    >
      {shown ? (
        <motion.span
          className="absolute inset-0 rounded-[6px] bg-row-active"
          layoutId={reduced ? undefined : "ask-turn-current"}
          transition={snappy}
        />
      ) : null}
      {label}
    </Pressable>
  );
}

interface QuestionTrailProps {
  crumbs: readonly TrailCrumb[];
  position: number;
  onStep: (index: number) => void;
}

export function QuestionTrail({
  crumbs,
  position,
  onStep,
}: QuestionTrailProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  return (
    <AnimatePresence initial={false}>
      {crumbs.length > 0 ? (
        <motion.nav
          animate={{ opacity: 1 }}
          aria-label="Question steps"
          className="flex h-8 shrink-0 items-center gap-0.5 overflow-hidden px-2.5 type-meta"
          exit={{ opacity: 0, transition: fadeOut }}
          initial={{ opacity: 0 }}
          key="trail"
          transition={fadeIn}
        >
          <AnimatePresence initial={false}>
            {crumbs.map((crumb, order) => (
              <Fragment
                key={
                  crumb.kind === "gap" ? `gap-${crumb.hidden[0]}` : crumb.index
                }
              >
                {order > 0 ? (
                  <ChevronRightIcon
                    aria-hidden
                    className="size-3 shrink-0 text-panel-muted/70"
                  />
                ) : null}
                {crumb.kind === "gap" ? (
                  <span
                    aria-label={`${crumb.hidden.length} more steps: ${crumb.hidden.join(", ")}`}
                    className="px-1 text-panel-muted"
                    role="img"
                    title={crumb.hidden.join(" › ")}
                  >
                    …
                  </span>
                ) : (
                  <Crumb
                    crumb={crumb}
                    onStep={onStep}
                    shown={!crumb.pending && crumb.index === position}
                  />
                )}
              </Fragment>
            ))}
          </AnimatePresence>
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}
