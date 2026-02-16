import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, ShieldCheck, Unplug } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

      <Button
        variant={safeMode ? "secondary" : "ghost"}
        size="icon-xs"
        onClick={handleToggleSafeMode}
        aria-label={safeMode ? "Disable safe mode" : "Enable safe mode"}
        title={safeMode ? "Safe mode: ON" : "Safe mode: OFF"}
      >
        <ShieldCheck className="size-3.5" />
      </Button>

      <Link to="/onboarding">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="New connection"
          title="Connect to new database"
        >
          <Plus className="size-3.5" />
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleDisconnect}
        aria-label="Disconnect"
        title={`Disconnect from ${connection.name}`}
      >
        <Unplug className="size-3.5" />
      </Button>
    </>
  );
};
