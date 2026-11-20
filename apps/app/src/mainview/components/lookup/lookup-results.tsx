import { AnimatePresence } from "motion/react";

import type { LookupHit } from "@/lib/ipc";

import type { LookupState } from "./lookup-reducer";

import { LookupHitRow, lookupHitId } from "./lookup-hit-row";
import { emptyCopy } from "./lookup-labels";
import { LookupMessage } from "./lookup-message";

export const LOOKUP_LIST_ID = "lookup-results";

interface LookupResultsProps {
  state: LookupState;
  selectedId: string | null;
  onHover: (id: string) => void;
  onOpen: (id: string) => void;
}

export function LookupResults({
  state,
  selectedId,
  onHover,
  onOpen,
}: LookupResultsProps) {
  if (state.status === "error" && state.error) {
    return <LookupMessage title={state.error.message} tone="error" />;
  }
  if (state.status === "done" && state.hits.length === 0) {
    const copy = emptyCopy(state);
    return <LookupMessage notes={copy.notes} title={copy.title} tone="empty" />;
  }
  return (
    <div
      aria-label="Tables holding the value"
      className="flex flex-col px-2 pb-2"
      id={LOOKUP_LIST_ID}
      role="listbox"
    >
      <AnimatePresence initial={false}>
        {state.hits.map((hit: LookupHit) => (
          <LookupHitRow
            hit={hit}
            key={lookupHitId(hit)}
            onHover={onHover}
            onOpen={onOpen}
            selected={lookupHitId(hit) === selectedId}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
