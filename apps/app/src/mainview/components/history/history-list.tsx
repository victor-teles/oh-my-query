import { AnimatePresence, motion } from "motion/react";

import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { useMotionPreset } from "@/lib/motion";

import type { HistoryRowContext } from "./history-row";
import type { HistorySection } from "./history-search";
import type { HistoryListMotion } from "./history-section";
import type { HistoryStatus } from "./use-history";

import { SectionRows } from "./history-section";
import {
  HistoryEmpty,
  HistoryError,
  HistoryNoMatches,
  HistorySkeleton,
} from "./history-states";

export const HISTORY_LIST_ID = "launcher-history-list";

export interface HistoryListView {
  status: HistoryStatus;
  sections: readonly HistorySection[];
  query: string;
  total: number;
}

const sectionStarts = (sections: readonly HistorySection[]) => {
  const starts: number[] = [];
  let count = 0;
  for (const section of sections) {
    starts.push(count);
    count += section.entries.length;
  }
  return { count, starts };
};

const matchCount = (count: number) =>
  `${count} ${count === 1 ? "ask matches" : "asks match"}`;

interface HistoryListProps {
  view: HistoryListView;
  rows: HistoryRowContext;
  motion: HistoryListMotion;
  onRetry: () => void;
}

export function HistoryList({
  view,
  rows,
  motion: list,
  onRetry,
}: HistoryListProps) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const skeleton = useDelayedVisibility(view.status === "loading");
  if (view.status === "error") {
    return <HistoryError onRetry={onRetry} />;
  }
  if (skeleton) {
    return <HistorySkeleton />;
  }
  if (view.status === "loading") {
    return null;
  }
  if (view.total === 0) {
    return <HistoryEmpty />;
  }
  if (view.sections.length === 0) {
    return <HistoryNoMatches query={view.query} />;
  }
  const { starts, count } = sectionStarts(view.sections);
  return (
    <>
      <p aria-live="polite" className="sr-only" role="status">
        {view.query.trim() ? matchCount(count) : ""}
      </p>
      <div
        aria-label="Past asks"
        className="relative flex flex-col gap-1 px-2 pb-2"
        id={HISTORY_LIST_ID}
        role="listbox"
      >
        <AnimatePresence mode="popLayout">
          {view.sections.map((section, sectionIndex) => {
            const start = starts[sectionIndex] ?? 0;
            return (
              <motion.div
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: fadeOut }}
                initial={reduced ? false : { opacity: 0 }}
                key={section.id}
                layout="position"
                transition={{ layout: snappy, opacity: fadeIn }}
              >
                <SectionRows
                  count={count}
                  motion={list}
                  offset={start}
                  rows={rows}
                  section={section}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
