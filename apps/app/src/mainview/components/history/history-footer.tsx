import type { FooterHint } from "@/components/launcher/launcher-footer";

import { LauncherFooter } from "@/components/launcher/launcher-footer";

import type { HistoryTarget } from "./history-actions";

import { HistoryStatus } from "./history-status";

const HINTS: FooterHint[] = [
  { keys: ["⌘", "K"], label: "Actions" },
  { keys: ["⌘", "C"], label: "Copy SQL" },
];

const actionLabelFor = (target: HistoryTarget | null): string | null => {
  if (!target) {
    return null;
  }
  return target.fallback ? `Ask on ${target.fallback.name}` : "Ask again";
};

interface HistoryFooterProps {
  hasSelection: boolean;
  target: HistoryTarget | null;
  status: { failure: string | null; message: string | null };
}

export function HistoryFooter({
  hasSelection,
  target,
  status,
}: HistoryFooterProps) {
  const needsConnection = hasSelection && !target;
  return (
    <LauncherFooter
      actionLabel={hasSelection ? actionLabelFor(target) : null}
      hints={hasSelection ? HINTS : []}
      status={
        <HistoryStatus
          failure={status.failure}
          hint={needsConnection ? "Add a connection to ask again" : null}
          message={status.message}
        />
      }
    />
  );
}
