import type { LucideIcon } from "lucide-react";

import type { RowTone } from "@/components/launcher/launcher-row";

export interface MenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: RowTone;
  disabled?: boolean;
  keys?: readonly string[];
}

export const DELETE_CONFIRM_LABEL = "Press ↵ again to delete";
