import type { Column } from "@tanstack/react-table";
import type { ComponentType, ReactNode } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Maximize2,
  MoreHorizontal,
  PinIcon,
  PinOff,
  StretchHorizontal,
} from "lucide-react";
import { useCallback } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnMenuApi {
  sortDir: false | "asc" | "desc";
  pinned: false | "left" | "right";
  handleSortAsc: () => void;
  handleSortDesc: () => void;
  handleClearSort: () => void;
  handlePinLeft: () => void;
  handlePinRight: () => void;
  handleUnpin: () => void;
  handleFitColumn: () => void;
  handleFitAllColumns: () => void;
}

const useColumnMenuApi = (
  column: Column<unknown[], unknown>,
  onFitColumn: (columnId: string) => void,
  onFitAllColumns: () => void
): ColumnMenuApi => {
  const handleSortAsc = useCallback(
    () => column.toggleSorting(false),
    [column]
  );
  const handleSortDesc = useCallback(
    () => column.toggleSorting(true),
    [column]
  );
  const handleClearSort = useCallback(() => column.clearSorting(), [column]);
  const handlePinLeft = useCallback(() => column.pin("left"), [column]);
  const handlePinRight = useCallback(() => column.pin("right"), [column]);
  const handleUnpin = useCallback(() => column.pin(false), [column]);
  const handleFitColumn = useCallback(
    () => onFitColumn(column.id),
    [column, onFitColumn]
  );
  return {
    handleClearSort,
    handleFitAllColumns: onFitAllColumns,
    handleFitColumn,
    handlePinLeft,
    handlePinRight,
    handleSortAsc,
    handleSortDesc,
    handleUnpin,
    pinned: column.getIsPinned(),
    sortDir: column.getIsSorted(),
  };
};

interface MenuItemsProps {
  api: ColumnMenuApi;
  ItemComponent: ComponentType<{
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }>;
  SeparatorComponent: ComponentType;
}

const MenuItems = ({
  api,
  ItemComponent: Item,
  SeparatorComponent: Separator,
}: MenuItemsProps) => (
  <>
    <Item disabled={api.sortDir === "asc"} onClick={api.handleSortAsc}>
      <ArrowUp />
      Sort ascending
    </Item>
    <Item disabled={api.sortDir === "desc"} onClick={api.handleSortDesc}>
      <ArrowDown />
      Sort descending
    </Item>
    {api.sortDir !== false && (
      <Item onClick={api.handleClearSort}>
        <ArrowUpDown />
        Clear sort
      </Item>
    )}
    <Separator />
    <Item disabled={api.pinned === "left"} onClick={api.handlePinLeft}>
      <PinIcon />
      Pin left
    </Item>
    <Item disabled={api.pinned === "right"} onClick={api.handlePinRight}>
      <PinIcon className="rotate-180" />
      Pin right
    </Item>
    {api.pinned !== false && (
      <Item onClick={api.handleUnpin}>
        <PinOff />
        Unpin
      </Item>
    )}
    <Separator />
    <Item onClick={api.handleFitColumn}>
      <Maximize2 />
      Fit column
    </Item>
    <Item onClick={api.handleFitAllColumns}>
      <StretchHorizontal />
      Fit all columns
    </Item>
  </>
);

interface ResultsColumnHeaderMenuProps {
  column: Column<unknown[], unknown>;
  onFitColumn: (columnId: string) => void;
  onFitAllColumns: () => void;
  children: ReactNode;
}

export const ResultsColumnHeaderMenu = ({
  column,
  onFitColumn,
  onFitAllColumns,
  children,
}: ResultsColumnHeaderMenuProps) => {
  const api = useColumnMenuApi(column, onFitColumn, onFitAllColumns);
  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItems
          ItemComponent={ContextMenuItem}
          SeparatorComponent={ContextMenuSeparator}
          api={api}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
};

interface ResultsColumnHeaderTriggerProps {
  column: Column<unknown[], unknown>;
  onFitColumn: (columnId: string) => void;
  onFitAllColumns: () => void;
}

export const ResultsColumnHeaderTrigger = ({
  column,
  onFitColumn,
  onFitAllColumns,
}: ResultsColumnHeaderTriggerProps) => {
  const api = useColumnMenuApi(column, onFitColumn, onFitAllColumns);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Column menu for ${column.id}`}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover/header:opacity-100 data-[popup-open]:opacity-100"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MenuItems
          ItemComponent={DropdownMenuItem}
          SeparatorComponent={DropdownMenuSeparator}
          api={api}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
