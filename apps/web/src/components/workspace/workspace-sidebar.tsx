import { Eye, Table2 } from "lucide-react";

import type { DatabaseConnection } from "@/lib/connections";

import { Separator } from "@/components/ui/separator";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface WorkspaceSidebarProps {
  connection: DatabaseConnection;
}

const PLACEHOLDER_TABLES = ["users", "orders", "products", "categories"];
const PLACEHOLDER_VIEWS = ["active_users", "order_summary"];

export const WorkspaceSidebar = ({ connection }: WorkspaceSidebarProps) => (
  <div
    className={cn(
      "flex h-full flex-col text-sidebar-foreground",
      isTauri() ? "bg-transparent" : "bg-sidebar"
    )}
  >
    <div className="px-3 py-2">
      <span className="truncate text-sm font-medium">{connection.name}</span>
    </div>

    <Separator className="bg-sidebar-border" />

    <div className="flex-1 overflow-y-auto px-2 py-2">
      <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tables
      </div>
      {PLACEHOLDER_TABLES.map((table) => (
        <button
          key={table}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <Eye className="size-3.5 text-muted-foreground" />
          {view}
        </button>
      ))}
    </div>
  </div>
);
