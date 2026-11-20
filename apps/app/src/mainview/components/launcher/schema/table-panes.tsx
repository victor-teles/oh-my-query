import type { KeyboardEvent, RefObject } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { RootItem } from "@/components/launcher/views/root-items";

import { LauncherListbox } from "@/components/launcher/launcher-list";
import { ROOT_LIST_ID } from "@/components/launcher/views/root-list";
import { Reveal } from "@/components/motion/reveal";
import { useMotionPreset } from "@/lib/motion";

import { TableDetail } from "./table-detail";
import { TableRow } from "./table-row";
import { tableSummary } from "./table-summary";

const SUMMARY_ID = "launcher-table-summary";

export type TableEntry = Extract<RootItem, { kind: "table" }>;

export interface TableList {
  items: readonly TableEntry[];
  selectedId: string | null;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export interface TableDetailPane {
  ref: RefObject<HTMLDivElement | null>;
  onExit: () => void;
}

interface TablePanesProps {
  list: TableList;
  detail: TableDetailPane;
}

export function TablePanes({ list, detail }: TablePanesProps) {
  const { onHover: handleHover, onRun: handleRun } = list;
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const selected =
    list.items.find((item) => item.id === list.selectedId) ?? null;

  const { onExit } = detail;
  const handleDetailKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onExit();
      }
    },
    [onExit]
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[2fr_3fr]">
      <div className="min-h-0 overflow-y-auto border-r border-panel-border pt-2">
        <LauncherListbox id={ROOT_LIST_ID} label="Tables">
          {list.items.map((item) => (
            <TableRow
              describedBy={item.id === list.selectedId ? SUMMARY_ID : undefined}
              id={item.id}
              key={item.id}
              onHover={handleHover}
              onRun={handleRun}
              schema={item.schema}
              selected={item.id === list.selectedId}
              table={item.table}
            />
          ))}
        </LauncherListbox>
      </div>
      <Reveal className="min-h-0">
        <div
          aria-label={
            selected ? `Columns of ${selected.table.name}` : "Columns"
          }
          className="h-full overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
          onKeyDown={handleDetailKeyDown}
          ref={detail.ref}
          role="region"
          tabIndex={0}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {selected ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                data-testid="table-detail"
                exit={{ opacity: 0, transition: fadeOut }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                key={selected.id}
                transition={fadeIn}
              >
                <TableDetail schema={selected.schema} table={selected.table} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </Reveal>
      <span className="sr-only" id={SUMMARY_ID}>
        {selected ? tableSummary(selected.table) : ""}
      </span>
    </div>
  );
}
