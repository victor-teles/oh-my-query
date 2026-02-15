import { Link, useNavigate } from "@tanstack/react-router";
import {
  PanelLeft,
  PanelLeftClose,
  Plus,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useCallback, useState } from "react";

import type { WorkspaceMode } from "@/components/workspace/workspace-mode-toggle";
import type { DatabaseConnection } from "@/lib/connections";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WorkspaceModeToggle } from "@/components/workspace/workspace-mode-toggle";

interface ConnectionToolbarProps {
  connection: DatabaseConnection;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
}

export const ConnectionToolbar = ({
  connection,
  sidebarCollapsed,
  onToggleSidebar,
  workspaceMode,
  onWorkspaceModeChange,
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
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="size-3.5" />
        ) : (
          <PanelLeftClose className="size-3.5" />
        )}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Badge variant="outline" className="gap-1 text-[0.6rem]">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {connection.name}
      </Badge>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <WorkspaceModeToggle
        mode={workspaceMode}
        onModeChange={onWorkspaceModeChange}
      />

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
