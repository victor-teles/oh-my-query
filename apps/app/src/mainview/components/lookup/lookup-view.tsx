import type { RefObject } from "react";

import { useCallback, useMemo } from "react";

import type { LookupHit } from "@/lib/ipc";

import { ConnectionStatus } from "@/components/launcher/connection-status";
import { ActiveConnectionChip } from "@/components/launcher/connections/active-connection-chip";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInputRow } from "@/components/launcher/launcher-input-row";
import { optionId } from "@/components/launcher/launcher-row";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

import type { LookupSession } from "./use-lookup";

import { lookupFooter } from "./lookup-footer";
import { LookupHeader } from "./lookup-header";
import { lookupHitId } from "./lookup-hit-row";
import { KIND_TAGS } from "./lookup-labels";
import { isSearching } from "./lookup-reducer";
import { LOOKUP_LIST_ID, LookupResults } from "./lookup-results";
import { useLookupKeyboard } from "./use-lookup-keyboard";

const CHIP = <ActiveConnectionChip />;
const STATUS = <ConnectionStatus />;

interface LookupViewProps {
  session: LookupSession;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenRows: (hit: LookupHit) => void;
}

export function LookupView({ session, inputRef, onOpenRows }: LookupViewProps) {
  const { state, cancel } = session;
  const searching = isSearching(state.status);
  const items = useMemo(
    () => state.hits.map((hit) => ({ hit, id: lookupHitId(hit) })),
    [state.hits]
  );
  const { move, select, selected } = useListSelection(items);
  const { copied, copy } = useCopyFeedback();
  const value = state.value?.value ?? "";

  const openById = useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (item) {
        onOpenRows(item.hit);
      }
    },
    [items, onOpenRows]
  );
  const openSelected = useCallback(() => {
    if (selected) {
      onOpenRows(selected.hit);
    }
  }, [onOpenRows, selected]);
  const copyValue = useCallback(() => copy(value), [copy, value]);
  const handleKeyDown = useLookupKeyboard({
    move,
    onCopy: copyValue,
    onOpen: openSelected,
    onStop: cancel,
    searching,
  });
  const footer = lookupFooter({
    copied,
    hasSelection: selected !== null,
    searching,
  });

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown}>
      <LauncherInputRow
        busy={searching}
        chip={CHIP}
        onStop={cancel}
        onSubmit={openSelected}
      >
        <input
          aria-activedescendant={selected ? optionId(selected.id) : undefined}
          aria-controls={LOOKUP_LIST_ID}
          aria-label={`Looking up ${state.value ? KIND_TAGS[state.value.kind] : "value"}`}
          autoFocus
          className="h-7 max-w-full min-w-0 truncate rounded-[7px] bg-row-hover px-2.5 font-mono text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          readOnly
          ref={inputRef}
          role="combobox"
          aria-expanded={items.length > 0}
          size={Math.max(8, value.length)}
          value={value}
        />
      </LauncherInputRow>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-panel-border">
        <LookupHeader state={state} />
        <LookupResults
          onHover={select}
          onOpen={openById}
          selectedId={selected?.id ?? null}
          state={state}
        />
      </div>
      <LauncherFooter
        actionLabel={footer.actionLabel}
        hints={footer.hints}
        status={STATUS}
      />
    </div>
  );
}
