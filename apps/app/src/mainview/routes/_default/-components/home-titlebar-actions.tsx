import { Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HomeTitlebarActionsProps {
  showAdd: boolean;
  onSettings: () => void;
  onAdd: () => void;
}

const HomeTitlebarActions = ({
  showAdd,
  onSettings,
  onAdd,
}: HomeTitlebarActionsProps) => (
  <>
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Settings"
            onClick={onSettings}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <Settings className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        Settings{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>,</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
    {showAdd && (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="New connection"
              onClick={onAdd}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <Plus className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>
          New connection{" "}
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>N</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    )}
  </>
);

export { HomeTitlebarActions };
