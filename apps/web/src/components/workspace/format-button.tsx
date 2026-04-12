import { AlignLeft } from "lucide-react";

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
          aria-label="Format SQL"
          disabled={disabled}
          onClick={onClick}
          size="icon-xs"
          variant="ghost"
        />
      }
    >
      <AlignLeft className="size-3.5" />
    </TooltipTrigger>
    <TooltipContent>Format SQL (⇧⌘F)</TooltipContent>
  </Tooltip>
);
