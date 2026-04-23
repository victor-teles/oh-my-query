import { Link } from "@tanstack/react-router";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ListCursor } from "@/components/ui/list-cursor";
import {
  getConnectionColorClasses,
  getEnvironmentStyle,
} from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

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
  connection.type === "sqlite" || connection.type === "duckdb"
    ? connection.database
    : `${connection.host}:${connection.port}/${connection.database}`;

const ConnectionListItem = ({
  connection,
  isSelected,
  isGlowing,
  onEditRequest,
  onDeleteRequest,
  onTogglePin,
  onLaunch,
}: {
  connection: DatabaseConnection;
  isSelected: boolean;
  isGlowing?: boolean;
  onEditRequest: (connection: DatabaseConnection) => void;
  onDeleteRequest: (connection: DatabaseConnection) => void;
  onTogglePin: (connection: DatabaseConnection) => void;
  onLaunch: (connection: DatabaseConnection) => void;
}) => {
  const identifier = getIdentifier(connection);
  const relativeTime = formatRelativeTime(connection.lastConnectedAt);
  const Icon = DATABASE_ICON_MAP[connection.type];
  const shouldReduceMotion = useReducedMotion();
  const colorClasses = getConnectionColorClasses(connection.color);
  const envStyle = getEnvironmentStyle(connection.environment);

  const handleEdit = useCallback(() => {
    onEditRequest(connection);
  }, [onEditRequest, connection]);

  const handleDelete = useCallback(() => {
    onDeleteRequest(connection);
  }, [onDeleteRequest, connection]);

  const handleTogglePin = useCallback(() => {
    onTogglePin(connection);
  }, [onTogglePin, connection]);

  const handleClick = useCallback(() => {
    onLaunch(connection);
  }, [onLaunch, connection]);

  const pinLabel = connection.pinned ? "Unpin" : "Pin";

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Link
            to="/workspace/$connectionId"
            params={{ connectionId: connection.id }}
          />
        }
        id={connection.id}
        role="option"
        aria-selected={isSelected}
        data-selected={isSelected ? "true" : undefined}
        onClick={handleClick}
        className="group/row relative flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/50 data-[selected=true]:bg-accent/70"
      >
        {isSelected && (
          <ListCursor
            layoutId="connection-cursor"
            className="inset-y-2 left-0 w-0.5"
          />
        )}
        {isGlowing && !shouldReduceMotion && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-primary/15"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            colorClasses?.tint ?? "bg-muted/40"
          )}
        >
          {connection.emoji ? (
            <span className="text-sm leading-none" aria-hidden="true">
              {connection.emoji}
            </span>
          ) : (
            <Icon className="size-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium tracking-tight text-foreground">
                {connection.name}
              </span>
              {envStyle && (
                <Badge
                  className={cn("h-4 px-1.5 text-[10px]", envStyle.badgeClass)}
                  variant="outline"
                >
                  {envStyle.label}
                </Badge>
              )}
            </div>
            <div className="relative shrink-0">
              <span
                className={cn(
                  "text-[11px] tracking-tight text-muted-foreground/70 transition-opacity duration-150",
                  isSelected ? "opacity-0" : "group-hover/row:opacity-0"
                )}
              >
                {relativeTime}
              </span>
            </div>
          </div>
          <span className="text-data truncate text-[11px] text-muted-foreground/80">
            {identifier}
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleTogglePin}>
          {connection.pinned ? <PinOff /> : <Pin />}
          {pinLabel}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} variant="destructive">
          <Trash2 />
          Delete
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export { ConnectionListItem };
