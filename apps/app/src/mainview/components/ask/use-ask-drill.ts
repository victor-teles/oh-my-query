import { CrosshairIcon } from "lucide-react";
import { useState } from "react";

import type { DrillSegment } from "@/lib/drill";
import type { DatabaseConnection } from "@/lib/ipc";

import {
  drillPrompt,
  drillSegments,
  isRedacted,
  segmentId,
  segmentLabel,
} from "@/lib/drill";

import type { AskState } from "./ask-reducer";
import type { ChipPrefill } from "./assumption-chips";
import type { DrillTarget } from "./drill-context";
import type { DrillItem } from "./drill-list";

import { atTurnLimit, shownTurn } from "./ask-reducer";
import { HIDDEN_BY_PII } from "./drill-context";

interface UseAskDrillOptions {
  state: AskState;
  connection: DatabaseConnection | null;
  prefill: (prefill: ChipPrefill) => void;
  focusInput: () => void;
}

export const useAskDrill = ({
  state,
  connection,
  prefill,
  focusInput,
}: UseAskDrillOptions) => {
  const [open, setOpen] = useState(false);
  const turn = shownTurn(state);
  const enabled =
    turn !== null && state.source === "question" && !atTurnLimit(state);
  const patterns = connection?.piiRedaction
    ? (connection.customPiiPatterns ?? [])
    : null;

  const isHidden = (segment: DrillSegment) =>
    patterns !== null && isRedacted(segment, patterns);
  const drill = (segment: DrillSegment) => {
    if (turn) {
      prefill({
        selection: null,
        text: drillPrompt(segment, turn.answer.spec.formats),
      });
    }
  };
  const target: DrillTarget | null = enabled ? { drill, isHidden } : null;

  const itemsOf = (): DrillItem[] =>
    turn
      ? drillSegments(turn.answer.spec, turn.answer.result, turn.view).map(
          (segment) => {
            const hidden = isHidden(segment);
            return {
              disabled: hidden,
              icon: CrosshairIcon,
              id: segmentId(segment),
              label: hidden
                ? HIDDEN_BY_PII
                : segmentLabel(segment, turn.answer.spec.formats),
              segment,
              tone: "default",
            };
          }
        )
      : [];
  const shown = open && enabled;

  return {
    close: () => {
      setOpen(false);
      focusInput();
    },
    items: shown ? itemsOf() : [],
    open: shown,
    pick: (item: DrillItem) => {
      setOpen(false);
      drill(item.segment);
    },
    target,
    toggle: () => {
      if (shown) {
        setOpen(false);
        focusInput();
      } else if (enabled && itemsOf().length > 0) {
        setOpen(true);
      }
    },
  };
};

export type AskDrill = ReturnType<typeof useAskDrill>;
