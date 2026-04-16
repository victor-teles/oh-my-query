import { Code2, Columns2, MessageSquare } from "lucide-react";
import { useCallback } from "react";

import type { WorkspaceMode } from "@/lib/workspace-mode";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      <TabsList className="h-6">
        <TabsTrigger
          aria-label="Editor mode"
          className="gap-1 px-2"
          value="editor"
        >
          <Code2 />
          <span>Editor</span>
        </TabsTrigger>
        <TabsTrigger
          aria-label="Split mode (editor and chat side by side)"
          className="gap-1 px-2"
          value="split"
        >
          <Columns2 />
          <span>Split</span>
        </TabsTrigger>
        <TabsTrigger aria-label="Chat mode" className="gap-1 px-2" value="chat">
          <MessageSquare />
          <span>Chat</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
