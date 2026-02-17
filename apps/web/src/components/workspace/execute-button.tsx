import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExecuteButtonProps {
  isRunning: boolean;
  disabled: boolean;
  hasSelection?: boolean;
  onClick: () => void;
}

export const ExecuteButton = ({
  isRunning,
  disabled,
  hasSelection,
  onClick,
}: ExecuteButtonProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="toolbar"
          onClick={onClick}
          disabled={disabled || isRunning}
        >
          {isRunning ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" />
          )}
        </Button>
      }
    />
    <TooltipContent>
      {hasSelection ? "Run selection (⌘↵)" : "Run query (⌘↵)"}
    </TooltipContent>
  </Tooltip>
);
