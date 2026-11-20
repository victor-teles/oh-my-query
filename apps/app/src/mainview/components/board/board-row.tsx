import { LayoutGridIcon } from "lucide-react";

import type { RowTone } from "@/components/launcher/launcher-row";
import type { Board } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";

interface BoardRowProps {
  id: string;
  board: Board;
  selected: boolean;
  tone: RowTone;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export const tileCount = (count: number) =>
  count === 1 ? "1 tile" : `${count} tiles`;

export function BoardRow({
  id,
  board,
  selected,
  tone,
  onHover,
  onRun,
}: BoardRowProps) {
  return (
    <LauncherRow
      id={id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
      tone={tone}
    >
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-[13px] leading-none text-panel-muted">
        {board.emoji ?? <LayoutGridIcon aria-hidden className="size-3.5" />}
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">{board.name}</span>
        <span className="truncate type-meta text-panel-muted">
          {tileCount(board.tiles.length)}
        </span>
      </span>
    </LauncherRow>
  );
}
