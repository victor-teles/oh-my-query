import { Code, MessageSquare } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

export type WorkspaceMode = "sql" | "chat";

interface WorkspaceModeToggleProps {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

export const WorkspaceModeToggle = ({
  mode,
  onModeChange,
}: WorkspaceModeToggleProps) => {
  const handleSql = useCallback(() => onModeChange("sql"), [onModeChange]);
  const handleChat = useCallback(() => onModeChange("chat"), [onModeChange]);

  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      <Button
        variant={mode === "sql" ? "secondary" : "ghost"}
        size="icon-xs"
        onClick={handleSql}
        aria-label="SQL Editor"
        title="SQL Editor"
      >
        <Code className="size-3.5" />
      </Button>
      <Button
        variant={mode === "chat" ? "secondary" : "ghost"}
        size="icon-xs"
        onClick={handleChat}
        aria-label="AI Chat"
        title="AI Chat"
      >
        <MessageSquare className="size-3.5" />
      </Button>
    </div>
  );
};
