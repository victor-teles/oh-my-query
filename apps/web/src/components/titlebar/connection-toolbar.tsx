import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, ShieldCheck, Unplug } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatPanelToggle } from "@/components/workspace/chat-panel-toggle";

interface ConnectionToolbarProps {
  connection: DatabaseConnection;
  isChatOpen: boolean;
  onChatToggle: () => void;
}

export const ConnectionToolbar = ({
  connection,
  isChatOpen,
  onChatToggle,
}: ConnectionToolbarProps) => {
  const navigate = useNavigate();
  const [safeMode, setSafeMode] = useState(true);

  const handleDisconnect = useCallback(async () => {
    await navigate({ to: "/" });
  }, [navigate]);

  const handleToggleSafeMode = useCallback(() => {
    setSafeMode((prev) => !prev);
  }, []);

  return (
    <>
      <ChatPanelToggle isOpen={isChatOpen} onToggle={onChatToggle} />

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={safeMode ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={handleToggleSafeMode}
              aria-label={safeMode ? "Disable safe mode" : "Enable safe mode"}
            />
          }
        >
          <ShieldCheck className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>
          {safeMode ? "Safe mode: ON" : "Safe mode: OFF"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Link to="/onboarding">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New connection"
              />
            </Link>
          }
        >
          <Plus className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>New connection</TooltipContent>
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
    </>
  );
};
