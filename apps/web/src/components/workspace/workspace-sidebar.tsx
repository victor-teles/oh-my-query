import { Eye, PanelLeftClose, Table2 } from "lucide-react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface WorkspaceSidebarProps {
  connection: DatabaseConnection;
  onToggle: () => void;
}

const PLACEHOLDER_TABLES = ["users", "orders", "products", "categories"];
const PLACEHOLDER_VIEWS = ["active_users", "order_summary"];

export const WorkspaceSidebar = ({
  connection,
  onToggle,
}: WorkspaceSidebarProps) => (
  <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
    {/* macOS traffic light safe zone + window drag area */}
    <div className="h-[52px] shrink-0" data-tauri-drag-region="" />

    {/* Sidebar header */}
    <div className="flex items-center justify-between px-3 pb-2">
      <span className="truncate text-sm font-medium">{connection.name}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onToggle}
        aria-label="Toggle sidebar"
      >
        <PanelLeftClose className="size-4" />
      </Button>
    </div>

    <Separator />

    {/* Database objects list */}
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tables
      </div>
      {PLACEHOLDER_TABLES.map((table) => (
        <button
          key={table}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Table2 className="size-3.5 text-muted-foreground" />
          {table}
        </button>
      ))}

      <div className="mb-2 mt-4 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Views
      </div>
      {PLACEHOLDER_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Eye className="size-3.5 text-muted-foreground" />
          {view}
        </button>
      ))}
    </div>
  </div>
);
