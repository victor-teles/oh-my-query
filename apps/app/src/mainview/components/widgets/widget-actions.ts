import {
  CopyPlusIcon,
  LayoutGridIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type {
  ExportActionId,
  ResultContext,
} from "@/components/result-actions/result-actions";

import { exportActions } from "@/components/result-actions/result-actions";

export type WidgetActionId =
  | ExportActionId
  | "edit-inputs"
  | "rename"
  | "duplicate"
  | "delete"
  | "add-to-board";

export interface WidgetAction extends MenuAction {
  id: WidgetActionId;
}

export const widgetActions = (context: ResultContext): WidgetAction[] => [
  ...exportActions(context),
  {
    icon: SlidersHorizontalIcon,
    id: "edit-inputs",
    label: "Edit Inputs",
    tone: "default",
  },
  { icon: PencilIcon, id: "rename", label: "Rename", tone: "default" },
  { icon: CopyPlusIcon, id: "duplicate", label: "Duplicate", tone: "default" },
  {
    icon: LayoutGridIcon,
    id: "add-to-board",
    label: "Add to Board",
    tone: "default",
  },
  { icon: Trash2Icon, id: "delete", label: "Delete", tone: "destructive" },
];
