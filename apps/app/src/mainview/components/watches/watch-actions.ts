import { isKpiSpec } from "@conch/rpc";
import { EyeIcon, GaugeIcon } from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { Watch, Widget } from "@/lib/ipc";

export type WatchActionId = "watch" | "menu-bar";

export interface WatchAction extends MenuAction {
  id: WatchActionId;
}

export const watchActions = (
  widget: Pick<Widget, "spec">,
  watch: Pick<Watch, "menuBar"> | null
): WatchAction[] => {
  const actions: WatchAction[] = [
    {
      icon: EyeIcon,
      id: "watch",
      label: watch ? "Edit Watch…" : "Watch…",
      tone: "default",
    },
  ];
  if (isKpiSpec(widget.spec)) {
    actions.push({
      icon: GaugeIcon,
      id: "menu-bar",
      label: watch?.menuBar ? "Remove from Menu Bar" : "Show in Menu Bar",
      tone: "default",
    });
  }
  return actions;
};
