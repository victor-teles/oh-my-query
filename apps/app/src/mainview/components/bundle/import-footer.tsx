import type { FooterHint } from "@/components/launcher/launcher-footer";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { ImportState } from "./import-reducer";

import { exportedOnLabel, importActionLabel } from "./bundle-labels";
import { importCounts } from "./import-reducer";

const REVIEW_HINTS: FooterHint[] = [
  { keys: ["Space"], label: "Toggle" },
  { keys: ["⌘", "E"], label: "SQL" },
];

interface FooterContent {
  action: string | null;
  keys: readonly string[];
  hints: readonly FooterHint[];
}

const contentFor = (state: ImportState): FooterContent => {
  if (state.phase === "done") {
    return { action: "Done", hints: [], keys: ["↩"] };
  }
  if (state.phase === "review" || state.phase === "error") {
    return {
      action: importActionLabel(importCounts(state)),
      hints: REVIEW_HINTS,
      keys: ["⌘", "↩"],
    };
  }
  if (state.phase === "choose" || state.phase === "invalid") {
    return { action: "Choose", hints: [], keys: ["↩"] };
  }
  return { action: null, hints: [], keys: [] };
};

const statusFor = (state: ImportState, busyShown: boolean): string | null => {
  if (busyShown && state.phase === "reading") {
    return "Reading…";
  }
  if (busyShown && state.phase === "importing") {
    return "Importing…";
  }
  if (state.phase === "review") {
    const counts = importCounts(state);
    return counts.widgets + counts.boards > 0
      ? exportedOnLabel(state.bundle.exportedAt)
      : "Nothing selected";
  }
  return null;
};

interface ImportFooterProps {
  state: ImportState;
}

export function ImportFooter({ state }: ImportFooterProps) {
  const busy = state.phase === "reading" || state.phase === "importing";
  const busyShown = useDelayedVisibility(busy);
  const status = statusFor(state, busyShown);
  const content = contentFor(state);
  return (
    <LauncherFooter
      actionKeys={content.keys}
      actionLabel={content.action}
      hints={content.hints}
      status={
        <span className="flex min-w-0 items-center" role="status">
          {status ? <SwapText className="truncate" value={status} /> : null}
        </span>
      }
    />
  );
}
