import type { RefObject } from "react";

import { TableModeBody } from "@/components/launcher/schema/table-mode-body";

import type { RootSectionsView } from "./use-root-sections";

import { ModeNote } from "./mode-note";
import { RootList } from "./root-list";

export interface RootListControls {
  selectedId: string | null;
  armedId: string | null;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

interface RootBodyProps {
  view: RootSectionsView;
  list: RootListControls;
  detail: { ref: RefObject<HTMLDivElement | null>; onExit: () => void };
}

export function RootBody({ view, list, detail }: RootBodyProps) {
  const { onHover: handleHover, onRun: handleRun } = list;
  if (view.tables) {
    const { retry: handleRetry } = view.tables;
    return (
      <TableModeBody
        catalog={view.tables.catalog}
        detail={detail}
        list={{
          items: view.items.filter((item) => item.kind === "table"),
          onHover: handleHover,
          onRun: handleRun,
          selectedId: list.selectedId,
        }}
        needle={view.input.mode === "table" ? view.input.needle : ""}
        onRetry={handleRetry}
      />
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-2">
      {view.note && view.sections.length === 0 ? (
        <ModeNote note={view.note} />
      ) : (
        <RootList
          armedId={list.armedId}
          onHover={handleHover}
          onRun={handleRun}
          query={view.query}
          sections={view.sections}
          selectedId={list.selectedId}
        />
      )}
    </div>
  );
}
