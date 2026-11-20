import { motion } from "motion/react";

import type { Bundle } from "@/lib/ipc";

import { useMotionPreset } from "@/lib/motion";

import { countLabel } from "./bundle-labels";
import { ImportCheckbox } from "./import-checkbox";
import { DIMMED_OPACITY } from "./import-widget-row";

export interface BoardLine {
  board: Bundle["boards"][number];
  importedTiles: number;
}

const tilesLabel = ({ board, importedTiles }: BoardLine): string =>
  importedTiles === board.tiles.length
    ? countLabel(importedTiles, "tile")
    : `${importedTiles} of ${countLabel(board.tiles.length, "tile")}`;

interface ImportBoardsRowProps {
  lines: readonly BoardLine[];
  checked: boolean;
  onToggle: () => void;
}

export function ImportBoardsRow({
  lines,
  checked,
  onToggle,
}: ImportBoardsRowProps) {
  const { reduced, fadeIn } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: checked ? 1 : DIMMED_OPACITY }}
      data-import-row
      initial={false}
      transition={reduced ? { duration: 0 } : fadeIn}
    >
      <ImportCheckbox checked={checked} onToggle={onToggle}>
        <span className="flex-1 type-body text-foreground">Import boards</span>
        <span className="type-meta text-panel-muted">
          {countLabel(lines.length, "board")}
        </span>
      </ImportCheckbox>
      <ul className="flex flex-col gap-0.5 pb-1.5 pl-[38px]">
        {lines.map((line) => (
          <li
            className="flex min-w-0 items-baseline gap-2 type-meta"
            key={line.board.ref}
          >
            <span className="truncate text-foreground">
              {line.board.emoji ? `${line.board.emoji} ` : ""}
              {line.board.name}
            </span>
            <span className="shrink-0 text-panel-muted">
              {tilesLabel(line)}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
