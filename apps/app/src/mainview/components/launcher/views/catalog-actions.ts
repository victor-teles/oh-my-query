import {
  CopyPlusIcon,
  LayoutGridIcon,
  PencilIcon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";

import type { RootItem } from "./root-items";

export type CatalogActionId =
  | "open-board"
  | "rename-board"
  | "duplicate-board"
  | "delete-board"
  | "run-widget"
  | "add-to-board";

export interface CatalogAction extends MenuAction {
  id: CatalogActionId;
}

export type CatalogItem = Extract<RootItem, { kind: "board" | "widget" }>;

export const isCatalogItem = (item: RootItem | null): item is CatalogItem =>
  item?.kind === "board" || item?.kind === "widget";

export const catalogActions = (item: CatalogItem): CatalogAction[] =>
  item.kind === "board"
    ? [
        {
          icon: SquareArrowOutUpRightIcon,
          id: "open-board",
          label: "Open",
          tone: "default",
        },
        {
          icon: PencilIcon,
          id: "rename-board",
          label: "Rename",
          tone: "default",
        },
        {
          icon: CopyPlusIcon,
          id: "duplicate-board",
          label: "Duplicate",
          tone: "default",
        },
        {
          icon: Trash2Icon,
          id: "delete-board",
          label: "Delete",
          tone: "destructive",
        },
      ]
    : [
        { icon: PlayIcon, id: "run-widget", label: "Run", tone: "default" },
        {
          icon: LayoutGridIcon,
          id: "add-to-board",
          label: "Add to Board…",
          tone: "default",
        },
      ];

export const catalogTitle = (item: CatalogItem): string =>
  item.kind === "board" ? item.board.name : item.widget.name;

interface ArmedSource {
  armed: boolean;
}

export const armedRowId = (
  menu: ArmedSource & { openId: string | null },
  catalog: ArmedSource & { item: { id: string } | null }
) => {
  if (menu.armed) {
    return menu.openId;
  }
  return catalog.armed ? (catalog.item?.id ?? null) : null;
};
