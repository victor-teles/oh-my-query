import type { ReactNode } from "react";

import { SwapText } from "@/components/motion/swap-text";

import { KeyCombo } from "./key-combo";

export interface FooterHint {
  label: string;
  keys: readonly string[];
}

interface LauncherFooterProps {
  status: ReactNode;
  actionLabel: string | null;
  actionKeys?: readonly string[];
  hints?: readonly FooterHint[];
}

export function LauncherFooter({
  status,
  actionLabel,
  actionKeys = ["↩"],
  hints = [],
}: LauncherFooterProps) {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-panel-border px-4 type-meta text-panel-muted">
      <div className="flex min-w-0 items-center gap-2">{status}</div>
      <div className="flex shrink-0 items-center gap-3">
        {actionLabel ? (
          <div className="flex items-center gap-2">
            <SwapText className="text-foreground" value={actionLabel} />
            <KeyCombo keys={actionKeys} />
          </div>
        ) : null}
        {hints.map((hint) => (
          <div
            className="flex items-center gap-2 border-l border-panel-border pl-3"
            key={hint.label}
          >
            <span>{hint.label}</span>
            <KeyCombo keys={hint.keys} />
          </div>
        ))}
      </div>
    </footer>
  );
}
