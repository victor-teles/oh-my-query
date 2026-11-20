import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { LookupState } from "./lookup-reducer";

import { announcement, statusLine, statusNotes } from "./lookup-labels";
import { LookupProgress } from "./lookup-progress";
import { isSearching } from "./lookup-reducer";

interface LookupHeaderProps {
  state: LookupState;
}

export function LookupHeader({ state }: LookupHeaderProps) {
  const planningShown = useDelayedVisibility(state.status === "planning");
  const quietPlanning = state.status === "planning" && !planningShown;
  const notes = statusNotes(state);
  return (
    <div className="relative px-4 pt-3 pb-1.5">
      <LookupProgress
        done={state.done}
        running={isSearching(state.status)}
        total={state.total}
      />
      <div aria-hidden className="flex min-h-5 flex-col gap-0.5">
        <SwapText
          className="type-body text-foreground"
          value={quietPlanning ? "" : statusLine(state)}
        />
        {notes.length > 0 ? (
          <span className="type-meta text-panel-muted">{notes.join(" ")}</span>
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement(state)}
      </span>
    </div>
  );
}
