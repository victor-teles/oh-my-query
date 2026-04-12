import { X } from "lucide-react";

import { Titlebar } from "@/components/titlebar/titlebar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SettingsTitlebarProps {
  onClose: () => void;
}

const SettingsTitlebar = ({ onClose }: SettingsTitlebarProps) => (
  <Titlebar
    center={
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-muted-foreground">
          Settings
        </span>
      </div>
    }
  >
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Close settings"
            onClick={onClose}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <X className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        Close settings <Kbd>Esc</Kbd>
      </TooltipContent>
    </Tooltip>
  </Titlebar>
);

export { SettingsTitlebar };
