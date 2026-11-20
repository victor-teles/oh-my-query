import { MessageSquareTextIcon } from "lucide-react";

import type { DatabaseConnection } from "@/lib/connections";

import { LauncherRow } from "./launcher-row";

interface AskRowProps {
  id: string;
  prompt: string;
  connection: DatabaseConnection;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function AskRow({
  id,
  prompt,
  connection,
  selected,
  onHover,
  onRun,
}: AskRowProps) {
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <MessageSquareTextIcon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-1.5 truncate type-body">
        <span className="shrink-0 text-panel-muted">
          Ask {connection.name}:
        </span>
        <span className="truncate text-foreground">“{prompt}”</span>
      </span>
    </LauncherRow>
  );
}
