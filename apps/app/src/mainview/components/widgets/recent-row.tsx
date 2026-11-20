import { HistoryIcon } from "lucide-react";

import type { RecentAsk } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";

interface RecentRowProps {
  id: string;
  ask: RecentAsk;
  connectionName: string | null;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function RecentRow({
  id,
  ask,
  connectionName,
  selected,
  onHover,
  onRun,
}: RecentRowProps) {
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <HistoryIcon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">{ask.prompt}</span>
        <span className="truncate type-meta text-panel-muted">
          {connectionName ?? ask.spec.title}
        </span>
      </span>
    </LauncherRow>
  );
}
