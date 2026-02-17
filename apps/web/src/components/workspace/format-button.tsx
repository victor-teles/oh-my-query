import { WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FormatButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export const FormatButton = ({ disabled, onClick }: FormatButtonProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          aria-label="Format SQL"
        />
      }
    >
      <WandSparkles className="size-3.5" />
    </TooltipTrigger>
    <TooltipContent>Format SQL (⇧⌘F)</TooltipContent>
  </Tooltip>
);
