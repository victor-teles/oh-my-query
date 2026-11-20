import { BellIcon, EyeIcon, GaugeIcon } from "lucide-react";

import type { Watch } from "@/lib/ipc";

export type WatchGlyphKind = "alert" | "menuBar" | "watch";

export const glyphKindOf = (
  watch: Pick<Watch, "alert" | "menuBar">
): WatchGlyphKind => {
  if (watch.menuBar) {
    return "menuBar";
  }
  return watch.alert ? "alert" : "watch";
};

const ICONS = { alert: BellIcon, menuBar: GaugeIcon, watch: EyeIcon };

const LABELS: Record<WatchGlyphKind, string> = {
  alert: "Has an alert",
  menuBar: "Shown in the menu bar",
  watch: "Watched",
};

export function WatchGlyph({ kind }: { kind: WatchGlyphKind }) {
  const Icon = ICONS[kind];
  return (
    <Icon
      aria-label={LABELS[kind]}
      className="size-3 shrink-0 text-panel-muted"
      role="img"
    />
  );
}
