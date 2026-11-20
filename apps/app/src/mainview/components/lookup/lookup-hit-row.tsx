import { TableIcon } from "lucide-react";

import type { LookupHit } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";

import { countLabel, rowsLabel } from "./lookup-labels";

export const lookupHitId = (hit: LookupHit): string => `lookup-hit-${hit.rank}`;

interface LookupHitRowProps {
  hit: LookupHit;
  selected: boolean;
  onHover: (id: string) => void;
  onOpen: (id: string) => void;
}

export function LookupHitRow({
  hit,
  selected,
  onHover,
  onOpen,
}: LookupHitRowProps) {
  return (
    <LauncherRow
      id={lookupHitId(hit)}
      onHover={onHover}
      onRun={onOpen}
      selected={selected}
    >
      <span className="relative grid size-6 shrink-0 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <TableIcon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">{hit.table}</span>
        <code className="truncate font-mono text-[12px] text-panel-muted">
          {hit.column}
        </code>
        <span className="shrink-0 type-micro text-panel-muted">
          {hit.schema}
        </span>
      </span>
      <span
        aria-label={rowsLabel(hit)}
        className="relative shrink-0 type-meta text-foreground tabular-nums"
      >
        {countLabel(hit)}
      </span>
    </LauncherRow>
  );
}
