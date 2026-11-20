import { cn } from "@/lib/utils";

import type { LauncherCommand } from "./root-commands";

import { KeyCombo } from "./key-combo";
import { LauncherRow } from "./launcher-row";

interface CommandRowProps {
  command: LauncherCommand;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function CommandRow({
  command,
  selected,
  onHover,
  onRun,
}: CommandRowProps) {
  const Icon = command.icon;
  return (
    <LauncherRow
      id={command.id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
    >
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">
          {command.title}
        </span>
        <span className="truncate type-meta text-panel-muted">
          {command.subtitle}
        </span>
      </span>
      {command.shortcut ? (
        <KeyCombo
          className={cn("relative", !selected && "opacity-70")}
          keys={command.shortcut}
        />
      ) : null}
    </LauncherRow>
  );
}
