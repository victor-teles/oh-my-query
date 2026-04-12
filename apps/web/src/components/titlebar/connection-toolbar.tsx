import { useNavigate } from "@tanstack/react-router";
import { Keyboard, ShieldCheck, ShieldOff, Unplug } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatPanelToggle } from "@/components/workspace/chat-panel-toggle";
import { useSafeMode } from "@/contexts/safe-mode-context";

interface ConnectionToolbarProps {
  connection: DatabaseConnection;
  isChatOpen: boolean;
  onChatToggle: () => void;
  onShowShortcuts: () => void;
}

export const ConnectionToolbar = ({
  connection,
  isChatOpen,
  onChatToggle,
  onShowShortcuts,
}: ConnectionToolbarProps) => {
  const navigate = useNavigate();
  const { enabled: safeMode, toggle: toggleSafeMode } = useSafeMode();

  const handleDisconnect = useCallback(async () => {
    await navigate({ to: "/" });
  }, [navigate]);

  return (
    <div className="flex items-center space-x-2">
      <ChatPanelToggle isOpen={isChatOpen} onToggle={onChatToggle} />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Keyboard shortcuts"
              onClick={onShowShortcuts}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <Keyboard className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>
          Keyboard shortcuts{" "}
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>/</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={safeMode ? "Disable safe mode" : "Enable safe mode"}
              onClick={toggleSafeMode}
              size="icon-xs"
              variant={safeMode ? "secondary" : "ghost"}
            />
          }
        >
          {safeMode ? (
            <ShieldCheck className="size-3.5" />
          ) : (
            <ShieldOff className="size-3.5 text-muted-foreground" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {safeMode
            ? "Safe mode: ON — confirms DROP, TRUNCATE, ALTER, and unscoped DELETE/UPDATE"
            : "Safe mode: OFF — destructive queries run without confirmation"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDisconnect}
              aria-label="Disconnect"
            />
          }
        >
          <Unplug className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Disconnect from {connection.name}</TooltipContent>
      </Tooltip>
    </div>
  );
};
