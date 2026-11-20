import type { KeyboardEvent } from "react";

import type { DrillSegment } from "@/lib/drill";

import { HIDDEN_BY_PII, useDrillTarget } from "./drill-context";

export const useRowDrill = (
  segmentAt: (rowIndex: number) => DrillSegment | null
) => {
  const target = useDrillTarget();
  if (!target) {
    return null;
  }
  return {
    rowProps: (rowIndex: number) => {
      const segment = segmentAt(rowIndex);
      const hidden = segment ? target.isHidden(segment) : false;
      if (!segment || hidden) {
        return { title: hidden ? HIDDEN_BY_PII : undefined };
      }
      const drill = () => target.drill(segment);
      return {
        onClick: drill,
        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            drill();
          }
        },
        tabIndex: 0,
        title: "Refine with this row",
      };
    },
  };
};
