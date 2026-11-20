import type { LucideIcon } from "lucide-react";

import { TILE_SIZES } from "@oh-my-query/rpc";
import {
  ClipboardCopyIcon,
  Maximize2Icon,
  RectangleHorizontalIcon,
  SquareIcon,
  SquareSplitHorizontalIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { TileSize } from "@/lib/ipc";

export type TileActionId = "open" | "copy-sql" | `size-${TileSize}` | "remove";

export interface TileAction extends MenuAction {
  id: TileActionId;
}

export const SIZE_LABELS: Record<TileSize, string> = {
  l: "Large",
  m: "Medium",
  s: "Small",
  wide: "Full width",
};

const SIZE_ICONS: Record<TileSize, LucideIcon> = {
  l: SquareSplitHorizontalIcon,
  m: RectangleHorizontalIcon,
  s: SquareIcon,
  wide: Maximize2Icon,
};

export const tileActions = (size: TileSize, hasSql: boolean): TileAction[] => [
  {
    icon: SquareArrowOutUpRightIcon,
    id: "open",
    label: "Open in Launcher",
    tone: "default",
  },
  {
    disabled: !hasSql,
    icon: ClipboardCopyIcon,
    id: "copy-sql",
    label: "Copy SQL",
    tone: "default",
  },
  ...TILE_SIZES.map(
    (option): TileAction => ({
      disabled: option === size,
      icon: SIZE_ICONS[option],
      id: `size-${option}`,
      label: SIZE_LABELS[option],
      tone: "default",
    })
  ),
  {
    icon: Trash2Icon,
    id: "remove",
    label: "Remove from Board",
    tone: "destructive",
  },
];

export const nextSize = (size: TileSize): TileSize =>
  TILE_SIZES[(TILE_SIZES.indexOf(size) + 1) % TILE_SIZES.length] ?? size;

export const sizeOfAction = (id: TileActionId): TileSize | null =>
  TILE_SIZES.find((size) => id === `size-${size}`) ?? null;
