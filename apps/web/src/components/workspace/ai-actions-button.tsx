import { Lightbulb, Sparkles, WandSparkles, Wrench } from "lucide-react";
import { useCallback } from "react";

import type { AIActionType } from "@/lib/ai-actions";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIActionsButtonProps {
  onAction: (action: AIActionType) => void;
  hasQuery: boolean;
  hasError: boolean;
}

export const AIActionsButton = ({
  onAction,
  hasQuery,
  hasError,
}: AIActionsButtonProps) => {
  const handleGenerate = useCallback(() => {
    onAction("generate");
  }, [onAction]);

  const handleExplain = useCallback(() => {
    onAction("explain");
  }, [onAction]);

  const handleFix = useCallback(() => {
    onAction("fix");
  }, [onAction]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="AI actions"
                />
              }
            >
              <Sparkles className="size-3.5" />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent>AI Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleGenerate}>
          <WandSparkles className="size-4" />
          Generate SQL
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExplain} disabled={!hasQuery}>
          <Lightbulb className="size-4" />
          Explain Query
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleFix}
          disabled={!hasQuery && !hasError}
        >
          <Wrench className="size-4" />
          Fix Query
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
