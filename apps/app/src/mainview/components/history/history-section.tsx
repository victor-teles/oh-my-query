import { AnimatePresence, useIsPresent } from "motion/react";
import { useId } from "react";

import type { HistoryRowContext } from "./history-row";
import type { HistorySection } from "./history-search";

import { HistoryRow } from "./history-row";

export interface HistoryListMotion {
  intro: boolean;
  clearing: boolean;
}

interface SectionGroupProps {
  section: HistorySection;
  offset: number;
  count: number;
  rows: HistoryRowContext;
  motion: HistoryListMotion;
}

export function SectionRows({
  section,
  offset,
  count,
  rows,
  motion: list,
}: SectionGroupProps) {
  const headingId = useId();
  const leaving = !useIsPresent();
  return (
    <div
      aria-hidden={leaving || undefined}
      aria-labelledby={headingId}
      inert={leaving}
      role="group"
    >
      <div
        className="px-2.5 pt-1 pb-1.5 type-micro text-panel-muted"
        id={headingId}
      >
        {section.label}
      </div>
      <AnimatePresence>
        {section.entries.map((match, index) => (
          <HistoryRow
            context={rows}
            key={match.id}
            match={match}
            motion={{
              count,
              index: offset + index,
              intro: list.intro,
              leaving: list.clearing,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
