import type {
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { TabularResult } from "@/lib/tauri";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExportSettings } from "@/hooks/use-export-settings";
import { rowsToTsv } from "@/lib/row-serializers";

import { NoResultsState } from "./no-results-state";
import { ResultsPagination } from "./results-pagination";
import { ResultsRowContextMenu } from "./results-row-context-menu";
import { RowDetailDialog } from "./row-detail-dialog";

interface ResultsTableProps {
  result: TabularResult;
  executedSql: string | null;
}

const CELL_CHAR_LIMIT = 120;

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const isNull = (value: unknown): boolean =>
  value === null || value === undefined;

const isNumber = (value: unknown): boolean => typeof value === "number";

const compareValues = (a: unknown, b: unknown): number => {
  const aNull = isNull(a);
  const bNull = isNull(b);
  if (aNull && bNull) {
    return 0;
  }
  if (aNull) {
    return 1;
  }
  if (bNull) {
    return -1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    if (a === b) {
      return 0;
    }
    return a ? 1 : -1;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

const sortingFn = (
  rowA: Row<unknown[]>,
  rowB: Row<unknown[]>,
  columnId: string
): number => compareValues(rowA.getValue(columnId), rowB.getValue(columnId));

interface TruncatedCellProps {
  columnName: string;
  value: string;
  onExpand: (cell: { column: string; value: string }) => void;
}

const TruncatedCell = ({ columnName, value, onExpand }: TruncatedCellProps) => {
  const handleClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onExpand({ column: columnName, value });
    },
    [columnName, value, onExpand]
  );

  return (
    <button
      className="block w-full truncate rounded text-left transition-colors hover:bg-accent"
      onClick={handleClick}
      title="Click to view full value"
      type="button"
    >
      {value.slice(0, CELL_CHAR_LIMIT)}
      <span className="text-muted-foreground">…</span>
    </button>
  );
};

export const ResultsTable = ({ result, executedSql }: ResultsTableProps) => {
  const { settings: exportSettings } = useExportSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedCell, setExpandedCell] = useState<{
    column: string;
    value: string;
  } | null>(null);
  const [detailRowIndex, setDetailRowIndex] = useState<number | null>(null);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setExpandedCell(null);
    }
  }, []);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDetailRowIndex(null);
    }
  }, []);

  useEffect(() => {
    setRowSelection({});
    setLastSelectedIndex(null);
    setActiveIndex(null);
    setSorting([]);
    setExpandedCell(null);
    setDetailRowIndex(null);
  }, [result]);

  const columns = useMemo(
    () =>
      result.columns.map((col, idx) => ({
        accessorFn: (row: unknown[]) => row[idx],
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue();
          if (isNull(value)) {
            return <span className="italic text-muted-foreground">NULL</span>;
          }
          const formatted = formatCell(value);
          if (formatted.length <= CELL_CHAR_LIMIT) {
            return <span className="block truncate">{formatted}</span>;
          }
          return (
            <TruncatedCell
              columnName={col.name}
              onExpand={setExpandedCell}
              value={formatted}
            />
          );
        },
        header: col.name,
        id: col.name,
        meta: { typeName: col.typeName },
        sortingFn,
      })),
    [result.columns]
  );

  const table = useReactTable({
    columnResizeMode: "onChange",
    columns,
    data: result.rows,
    defaultColumn: { minSize: 60, size: 180 },
    enableRowSelection: true,
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { rowSelection, sorting },
  });

  const selectedRowIndices = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((key) => rowSelection[key])
        .map(Number),
    [rowSelection]
  );

  const selectAll = useCallback(() => {
    const next: RowSelectionState = {};
    for (let i = 0; i < result.rows.length; i += 1) {
      next[i] = true;
    }
    setRowSelection(next);
  }, [result.rows.length]);

  useHotkey("Mod+A", selectAll, { target: containerRef });

  const handleRowClick = useCallback(
    (event: MouseEvent, rowIndex: number) => {
      containerRef.current?.focus();
      setActiveIndex(rowIndex);
      if (event.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, rowIndex);
        const end = Math.max(lastSelectedIndex, rowIndex);
        const next: RowSelectionState = {};
        for (let i = start; i <= end; i += 1) {
          next[i] = true;
        }
        setRowSelection(next);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        setRowSelection((prev) => {
          if (prev[rowIndex]) {
            const { [rowIndex]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [rowIndex]: true };
        });
        setLastSelectedIndex(rowIndex);
        return;
      }
      setRowSelection({ [rowIndex]: true });
      setLastSelectedIndex(rowIndex);
    },
    [lastSelectedIndex]
  );

  const moveActive = useCallback(
    (direction: 1 | -1, extend: boolean) => {
      const pageIndices = table.getRowModel().rows.map((row) => row.index);
      if (pageIndices.length === 0) {
        return;
      }
      const currentPos =
        activeIndex === null ? -1 : pageIndices.indexOf(activeIndex);
      const nextPos =
        currentPos === -1 && direction === 1
          ? 0
          : Math.max(
              0,
              Math.min(pageIndices.length - 1, currentPos + direction)
            );
      const nextActive = pageIndices[nextPos];
      if (nextActive === undefined) {
        return;
      }
      setActiveIndex(nextActive);
      containerRef.current?.focus();
      if (extend && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, nextActive);
        const end = Math.max(lastSelectedIndex, nextActive);
        const next: RowSelectionState = {};
        for (let i = start; i <= end; i += 1) {
          next[i] = true;
        }
        setRowSelection(next);
        return;
      }
      setRowSelection({ [nextActive]: true });
      setLastSelectedIndex(nextActive);
    },
    [table, activeIndex, lastSelectedIndex]
  );

  const toggleActiveSelection = useCallback(() => {
    if (activeIndex === null) {
      return;
    }
    setRowSelection((prev) => {
      if (prev[activeIndex]) {
        const { [activeIndex]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [activeIndex]: true };
    });
    setLastSelectedIndex(activeIndex);
  }, [activeIndex]);

  const handleKeyboardCopy = useCallback(() => {
    let indices: number[];
    if (selectedRowIndices.length > 0) {
      indices = selectedRowIndices;
    } else if (activeIndex !== null) {
      indices = [activeIndex];
    } else {
      return;
    }
    const sorted = [...indices].toSorted((a, b) => a - b);
    const tsv = rowsToTsv({
      columns: result.columns,
      rows: sorted.map((i) => result.rows[i] ?? []),
    });
    navigator.clipboard.writeText(tsv);
    toast.success(
      `Copied ${indices.length} row${indices.length === 1 ? "" : "s"}`
    );
  }, [selectedRowIndices, activeIndex, result]);

  const openDetailForActive = useCallback(() => {
    if (activeIndex !== null) {
      setDetailRowIndex(activeIndex);
    }
  }, [activeIndex]);

  useHotkey("ArrowDown", () => moveActive(1, false), { target: containerRef });
  useHotkey("ArrowUp", () => moveActive(-1, false), { target: containerRef });
  useHotkey("Shift+ArrowDown", () => moveActive(1, true), {
    target: containerRef,
  });
  useHotkey("Shift+ArrowUp", () => moveActive(-1, true), {
    target: containerRef,
  });
  useHotkey("Space", toggleActiveSelection, { target: containerRef });
  useHotkey("Enter", openDetailForActive, { target: containerRef });
  useHotkey("Mod+C", handleKeyboardCopy, { target: containerRef });

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${activeIndex}"]`
    );
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  const isEmpty = table.getRowModel().rows.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        tabIndex={-1}
        className={`outline-none ${
          isEmpty
            ? "flex flex-1 flex-col overflow-auto"
            : "flex-1 overflow-auto"
        }`}
      >
        <Table
          style={{
            tableLayout: "fixed",
            width: table.getTotalSize(),
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  let SortIcon = ArrowUpDown;
                  if (sortDir === "asc") {
                    SortIcon = ArrowUp;
                  } else if (sortDir === "desc") {
                    SortIcon = ArrowDown;
                  }
                  return (
                    <TableHead
                      className="relative"
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      <button
                        aria-label={`Sort by ${header.column.id}`}
                        className="group flex w-full items-center justify-between gap-2 text-left"
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium tracking-tight">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          <span className="truncate font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                            {(
                              header.column.columnDef.meta as {
                                typeName: string;
                              }
                            )?.typeName ?? ""}
                          </span>
                        </div>
                        <SortIcon
                          className={`size-3 shrink-0 transition-opacity ${
                            sortDir
                              ? "text-foreground opacity-100"
                              : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </button>
                      <div
                        aria-hidden="true"
                        className={`absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none transition-colors hover:bg-ring ${
                          header.column.getIsResizing() ? "bg-ring" : ""
                        }`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      />
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          {!isEmpty && (
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <ResultsRowContextMenu
                  key={row.id}
                  result={result}
                  executedSql={executedSql}
                  rowIndex={row.index}
                  selectedRowIndices={selectedRowIndices}
                  exportSettings={exportSettings}
                  isSelected={row.getIsSelected()}
                  isActive={row.index === activeIndex}
                  onRowClick={handleRowClick}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={`text-data overflow-hidden ${
                        isNumber(cell.getValue()) ? "text-right" : ""
                      }`}
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </ResultsRowContextMenu>
              ))}
            </TableBody>
          )}
        </Table>
        {isEmpty && <NoResultsState label="rows" />}
      </div>
      {table.getPageCount() > 1 && <ResultsPagination table={table} />}
      <Dialog
        onOpenChange={handleDialogOpenChange}
        open={expandedCell !== null}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {expandedCell?.column}
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-foreground text-xs leading-relaxed">
            {expandedCell?.value}
          </pre>
        </DialogContent>
      </Dialog>
      <RowDetailDialog
        onOpenChange={handleDetailOpenChange}
        result={result}
        rowIndex={detailRowIndex}
      />
    </div>
  );
};
