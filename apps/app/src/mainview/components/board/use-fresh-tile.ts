import { useEffect, useState } from "react";

import type { BoardTile } from "@/lib/ipc";

import { useMotionPreset } from "@/lib/motion";

import { findTileElement } from "./board-tile";

const FRESH_FOR_MS = 1000;

// A tile that appears after the board first loaded was just added from the
// launcher: it gets one pulse and is scrolled into view.
export const useFreshTile = (tiles: readonly BoardTile[]): string | null => {
  const { reduced } = useMotionPreset();
  const [seen, setSeen] = useState(() => new Set(tiles.map((tile) => tile.id)));
  const freshId = tiles.find((tile) => !seen.has(tile.id))?.id ?? null;

  useEffect(() => {
    if (!freshId) {
      return;
    }
    findTileElement(freshId)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
    });
    const timer = window.setTimeout(
      () => setSeen(new Set(tiles.map((tile) => tile.id))),
      FRESH_FOR_MS
    );
    return () => window.clearTimeout(timer);
  }, [freshId, reduced, tiles]);

  return freshId;
};
