import { Link } from "@tanstack/react-router";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) {
    return "Not yet";
  }
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MINUTE) {
    return "Just now";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)}m ago`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}h ago`;
  }
  if (diff < 2 * DAY) {
    return "Yesterday";
  }
  if (diff < WEEK) {
    return `${Math.floor(diff / DAY)}d ago`;
  }
  if (diff < MONTH) {
    return `${Math.floor(diff / WEEK)}w ago`;
  }
  if (diff < YEAR) {
    return `${Math.floor(diff / MONTH)}mo ago`;
  }
  return `${Math.floor(diff / YEAR)}y ago`;
};

const getIdentifier = (connection: DatabaseConnection): string =>
  connection.type === "sqlite"
    ? connection.database
    : `${connection.host}:${connection.port}/${connection.database}`;

const ConnectionListItem = ({
  connection,
  isSelected,
  onEditRequest,
  onDeleteRequest,
  onTogglePin,
  onSelect,
}: {
  connection: DatabaseConnection;
  isSelected: boolean;
  onEditRequest: (connection: DatabaseConnection) => void;
  onDeleteRequest: (connection: DatabaseConnection) => void;
  onTogglePin: (connection: DatabaseConnection) => void;
  onSelect: (id: string) => void;
}) => {
  const identifier = getIdentifier(connection);
  const relativeTime = formatRelativeTime(connection.lastConnectedAt);
  const Icon = DATABASE_ICON_MAP[connection.type];

  const handleEdit = useCallback(() => {
    onEditRequest(connection);
  }, [onEditRequest, connection]);

  const handleDelete = useCallback(() => {
    onDeleteRequest(connection);
  }, [onDeleteRequest, connection]);

  const handleTogglePin = useCallback(() => {
    onTogglePin(connection);
  }, [onTogglePin, connection]);

  const handlePointerEnter = useCallback(() => {
    onSelect(connection.id);
  }, [onSelect, connection.id]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Link
            to="/workspace/$connectionId"
            params={{ connectionId: connection.id }}
          />
        }
        onPointerEnter={handlePointerEnter}
        data-selected={isSelected ? "true" : undefined}
        className="group/row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/50 data-[selected=true]:bg-accent/70"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium tracking-tight text-foreground">
              {connection.name}
            </span>
            <span className="shrink-0 text-[11px] tracking-tight text-muted-foreground/70">
              {relativeTime}
            </span>
          </div>
          <span className="text-data truncate text-[11px] text-muted-foreground/80">
            {identifier}
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleTogglePin}>
          {connection.pinned ? <PinOff /> : <Pin />}
          {connection.pinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} variant="destructive">
          <Trash2 />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export { ConnectionListItem };
