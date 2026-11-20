import type { TableItem } from "@oh-my-query/core/client";

import { TableIcon } from "lucide-react";

import { LauncherRow } from "@/components/launcher/launcher-row";

import { rowEstimateLabel } from "./table-summary";

interface TableRowProps {
  id: string;
  schema: string;
  table: TableItem;
  selected: boolean;
  describedBy?: string;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function TableRow({
  id,
  schema,
  table,
  selected,
  describedBy,
  onHover,
  onRun,
}: TableRowProps) {
  return (
    <LauncherRow
      describedBy={describedBy}
      id={id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
    >
      <TableIcon
        aria-hidden
        className="relative size-3.5 shrink-0 text-panel-muted"
      />
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-[12px] text-foreground">
          {table.name}
        </span>
        <span className="truncate type-micro text-panel-muted">
          {schema} · {rowEstimateLabel(table.rowEstimate)}
        </span>
      </span>
    </LauncherRow>
  );
}
