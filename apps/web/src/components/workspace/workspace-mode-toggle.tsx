import { useCallback } from "react";

import type { WorkspaceMode } from "@/lib/workspace-mode";

import { TITLEBAR_CONTROL_HEIGHT } from "@/components/titlebar/titlebar";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WorkspaceModeToggleProps {
  mode: WorkspaceMode;
  onChange: (next: WorkspaceMode) => void;
}

const isWorkspaceMode = (value: string): value is WorkspaceMode =>
  value === "editor" || value === "split" || value === "chat";

export const WorkspaceModeToggle = ({
  mode,
  onChange,
}: WorkspaceModeToggleProps) => {
  const handleChange = useCallback(
    (value: string | number | null) => {
      if (typeof value === "string" && isWorkspaceMode(value)) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <Tabs onValueChange={handleChange} value={mode}>
      <TabsList
        aria-label="Workspace mode"
        className={cn(TITLEBAR_CONTROL_HEIGHT, "bg-background/85")}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger className="px-2" value="editor">
                Editor
              </TabsTrigger>
            }
          />
          <TooltipContent className="flex items-center gap-2">
            Editor only querying
            <KbdGroup>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>1</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger className="px-2" value="split">
                Split
              </TabsTrigger>
            }
          />
          <TooltipContent className="flex items-center gap-2">
            Editor and chat side by side
            <KbdGroup>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>2</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger className="px-2" value="chat">
                Chat
              </TabsTrigger>
            }
          />
          <TooltipContent className="flex items-center gap-2">
            Chat only querying
            <KbdGroup>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>3</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      </TabsList>
    </Tabs>
  );
};
