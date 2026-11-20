import {
  CopyPlusIcon,
  DownloadIcon,
  LayoutGridIcon,
  PencilIcon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { WatchActionId } from "@/components/watches/watch-actions";
import type { Watch } from "@/lib/ipc";

import { watchActions } from "@/components/watches/watch-actions";

import type { RootItem } from "./root-items";

export type CatalogActionId =
  | "open-board"
  | "rename-board"
  | "duplicate-board"
  | "delete-board"
  | "run-widget"
  | "add-to-board"
  | "export-board"
  | "export-widget"
  | WatchActionId;

export interface CatalogAction extends MenuAction {
  id: CatalogActionId;
}

export type CatalogItem = Extract<RootItem, { kind: "board" | "widget" }>;

export const isCatalogItem = (item: RootItem | null): item is CatalogItem =>
  item?.kind === "board" || item?.kind === "widget";

export const catalogActions = (
  item: CatalogItem,
  watch: Watch | null = null
): CatalogAction[] =>
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
          icon: DownloadIcon,
          id: "export-board",
          label: "Export Board",
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
        {
          icon: DownloadIcon,
          id: "export-widget",
          label: "Export Widget",
          tone: "default",
        },
        ...watchActions(item.widget, watch),
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
