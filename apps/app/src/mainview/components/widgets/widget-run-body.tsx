import type { Ref } from "react";

import { AnimatePresence, motion } from "motion/react";

import type { CardSlots } from "@/components/ask/ask-card";
import type { CardViewKind } from "@/lib/card-data";
import type { CardSpec } from "@/lib/ipc";

import { AskCard } from "@/components/ask/ask-card";
import { AskSkeleton } from "@/components/ask/ask-skeleton";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { Reveal } from "@/components/motion/reveal";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { useMotionPreset } from "@/lib/motion";

import type { WidgetRunState } from "./widget-run-reducer";

const STALE_OPACITY = 0.6;

interface WidgetRunBodyProps {
  run: WidgetRunState;
  spec: CardSpec;
  view: CardViewKind;
  onSelectView: (view: CardViewKind) => void;
  slots?: CardSlots;
  cardRef?: Ref<HTMLElement>;
}

export function WidgetRunBody({
  run,
  spec,
  view,
  onSelectView,
  slots,
  cardRef,
}: WidgetRunBodyProps) {
  const { fadeIn } = useMotionPreset();
  const running = run.status === "running";
  const showSkeleton = useDelayedVisibility(running && !run.outcome);
  const { outcome } = run;

  if (!outcome) {
    return showSkeleton ? <AskSkeleton /> : <div className="h-6" />;
  }
  if (outcome.result.rowCount === 0) {
    return (
      <div className="relative">
        <AnimatePresence>
          {running ? <ProgressHairline /> : null}
        </AnimatePresence>
        <Reveal className="flex flex-col gap-1 px-4 pt-3 pb-6">
          <p className="type-body text-foreground" role="status">
            No rows for these inputs.
          </p>
          <p className="type-meta text-panel-muted">
            Try a wider date range or another value.
          </p>
        </Reveal>
      </div>
    );
  }
  return (
    <div className="relative">
      <AnimatePresence>{running ? <ProgressHairline /> : null}</AnimatePresence>
      <motion.div
        animate={{ opacity: running ? STALE_OPACITY : 1 }}
        aria-busy={running}
        transition={fadeIn}
      >
        <AskCard
          intro={run.completedRuns > 1 ? "update" : "play"}
          onSelectView={onSelectView}
          ref={cardRef}
          result={outcome.result}
          slots={slots}
          spec={spec}
          view={view}
        />
      </motion.div>
    </div>
  );
}
