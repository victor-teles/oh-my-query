import type { ReactNode } from "react";

import { createContext, use } from "react";

import type { DrillSegment } from "@/lib/drill";

export interface DrillTarget {
  drill: (segment: DrillSegment) => void;
  isHidden: (segment: DrillSegment) => boolean;
}

const DrillContext = createContext<DrillTarget | null>(null);

// Only the ask view provides a target; cards on boards and widget runs read
// null and stay inert.
export function DrillProvider({
  target,
  children,
}: {
  target: DrillTarget | null;
  children: ReactNode;
}) {
  return <DrillContext value={target}>{children}</DrillContext>;
}

export const useDrillTarget = (): DrillTarget | null => use(DrillContext);

export const HIDDEN_BY_PII = "Hidden by PII redaction";
