import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExecuteButtonProps {
  isRunning: boolean;
  disabled: boolean;
  onClick: () => void;
}

export const ExecuteButton = ({
  isRunning,
  disabled,
  onClick,
}: ExecuteButtonProps) => (
  <Button variant="toolbar" onClick={onClick} disabled={disabled || isRunning}>
    {isRunning ? (
      <Loader2 className="size-3 animate-spin" />
    ) : (
      <Play className="size-3" />
    )}
    <span>{isRunning ? "Running..." : "Run"}</span>
    {!isRunning && (
      <kbd className="ml-1 rounded border border-border/40 bg-background/50 px-1 py-0.5 text-[0.55rem] text-muted-foreground/70">
        ⌘↵
      </kbd>
    )}
  </Button>
);
