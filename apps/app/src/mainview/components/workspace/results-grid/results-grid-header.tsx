import type { Header, Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { flexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback } from "react";

import type { ResultsColumnMeta } from "./-hooks/use-results-columns";

import { getColumnPinStyle } from "./-hooks/use-column-pin-style";
import { HEADER_ROW_HEIGHT } from "./constants";
import {
  ResultsColumnHeaderMenu,
  ResultsColumnHeaderTrigger,
} from "./results-column-header-menu";

interface ResultsGridHeaderProps {
  table: Table<unknown[]>;
  onFitColumn: (columnId: string) => void;
  onFitAllColumns: () => void;
}

interface HeaderCellProps {
  header: Header<unknown[], unknown>;
  onFitColumn: (columnId: string) => void;
  onFitAllColumns: () => void;
}

const HeaderCell = ({
  header,
  onFitColumn,
  onFitAllColumns,
}: HeaderCellProps) => {
  const sortDir = header.column.getIsSorted();
  let SortIcon = ArrowUpDown;
  if (sortDir === "asc") {
    SortIcon = ArrowUp;
  } else if (sortDir === "desc") {
    SortIcon = ArrowDown;
  }
  const meta = header.column.columnDef.meta as ResultsColumnMeta | undefined;
  const pin = getColumnPinStyle(header.column);

  const handleResizeDoubleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onFitColumn(header.column.id);
    },
    [header.column.id, onFitColumn]
  );

  return (
    <ResultsColumnHeaderMenu
      column={header.column}
      onFitAllColumns={onFitAllColumns}
      onFitColumn={onFitColumn}
    >
      <div
        aria-colindex={(meta?.columnIndex ?? 0) + 1}
        className="
          group/header relative flex shrink-0 items-center gap-1 bg-background
          px-2 text-foreground
          data-first-right-pin:shadow-[inset_1px_0_0_0_var(--color-border)]
          data-last-left-pin:shadow-[inset_-1px_0_0_0_var(--color-border)]
          group-data-scrolled-x/grid:data-last-left-pin:shadow-[4px_0_6px_-2px_rgb(0_0_0/0.25),inset_-1px_0_0_0_var(--color-border)]
          data-pinned:z-30
        "
        role="columnheader"
        style={{ ...pin.style, width: header.getSize() }}
        {...pin.dataAttrs}
      >
        <button
          aria-label={`Sort by ${header.column.id}`}
          className="
            group flex min-w-0 flex-1 items-center justify-between gap-2
            text-left
          "
          onClick={header.column.getToggleSortingHandler()}
          type="button"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xs font-medium tracking-tight">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
            <span
              className="
                truncate font-mono text-[10px] tracking-wider
                text-muted-foreground/70 uppercase
              "
            >
              {meta?.typeName ?? ""}
            </span>
          </div>
          <SortIcon className={`
              size-3 shrink-0 transition-opacity
              ${sortDir ? "text-foreground opacity-100" : `
                    text-muted-foreground/50 opacity-0
                    group-hover:opacity-100
                  `}
            `} />
        </button>
        <ResultsColumnHeaderTrigger
          column={header.column}
          onFitAllColumns={onFitAllColumns}
          onFitColumn={onFitColumn}
        />
        <div aria-hidden="true" className={`
            absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none
            transition-colors select-none
            hover:bg-ring
            ${header.column.getIsResizing() ? "bg-ring" : ""}
          `} onDoubleClick={handleResizeDoubleClick} onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} />
      </div>
    </ResultsColumnHeaderMenu>
  );
};

export const ResultsGridHeader = ({
  table,
  onFitColumn,
  onFitAllColumns,
}: ResultsGridHeaderProps) => (
  <>
    {table.getHeaderGroups().map((headerGroup) => (
      <div
        aria-rowindex={1}
        className="
          sticky top-0 z-20 flex border-b border-border/60 bg-background
        "
        key={headerGroup.id}
        role="row"
        style={{ height: HEADER_ROW_HEIGHT, width: table.getTotalSize() }}
      >
        {headerGroup.headers.map((header) => (
          <HeaderCell
            header={header}
            key={header.id}
            onFitAllColumns={onFitAllColumns}
            onFitColumn={onFitColumn}
          />
        ))}
      </div>
    ))}
  </>
);
