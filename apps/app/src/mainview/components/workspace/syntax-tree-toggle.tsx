import { TreePine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SyntaxTreeToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SyntaxTreeToggle = ({
  isOpen,
  onToggle,
}: SyntaxTreeToggleProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant={isOpen ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={onToggle}
          aria-label={isOpen ? "Close Syntax Tree" : "Open Syntax Tree"}
        />
      }
    >
      <TreePine className="size-3.5" />
    </TooltipTrigger>
    <TooltipContent>
      {isOpen ? "Close Syntax Tree" : "Open Syntax Tree"} (Cmd+Shift+D)
    </TooltipContent>
  </Tooltip>
);
