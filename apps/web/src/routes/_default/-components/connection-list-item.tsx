import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const ConnectionListItem = ({
  connection,
  onEditRequest,
  onDeleteRequest,
}: {
  connection: DatabaseConnection;
  onEditRequest: (connection: DatabaseConnection) => void;
  onDeleteRequest: (connection: DatabaseConnection) => void;
}) => {
  const subtitle =
    connection.type === "sqlite"
      ? connection.database
      : `${connection.host}:${connection.port}/${connection.database}`;
  const Icon = DATABASE_ICON_MAP[connection.type];

  const handleEdit = useCallback(() => {
    onEditRequest(connection);
  }, [onEditRequest, connection]);

  const handleDelete = useCallback(() => {
    onDeleteRequest(connection);
  }, [onDeleteRequest, connection]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Link
            to="/workspace/$connectionId"
            params={{ connectionId: connection.id }}
          />
        }
        className="flex h-9 items-center gap-2.5 px-3 transition-colors hover:bg-accent/50"
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{connection.name}</span>
        <span className="truncate text-[0.625rem] text-muted-foreground">
          {connection.type} &middot; {subtitle}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} variant="destructive">
          <Trash2 />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export { ConnectionListItem };
