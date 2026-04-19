import type {
  ColumnPinningState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TabularResult } from "@/lib/tauri";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoResultsState } from "@/components/workspace/no-results-state";
import { RowDetailDialog } from "@/components/workspace/row-detail-dialog";
import { useExportSettings } from "@/hooks/use-export-settings";

import { useColumnAutoSize } from "./-hooks/use-column-auto-size";
import { useGridHotkeys } from "./-hooks/use-grid-hotkeys";
import { useResultsColumns } from "./-hooks/use-results-columns";
import { useRowSelection } from "./-hooks/use-row-selection";
import { BODY_ROW_HEIGHT } from "./constants";
import { ResultsGridBody } from "./results-grid-body";
import { ResultsGridFooter } from "./results-grid-footer";
import { ResultsGridHeader } from "./results-grid-header";

interface ResultsGridProps {
  result: TabularResult;
  executedSql: string | null;
  onLoadMore?: (nextMaxRows: number) => void;
}

export const ResultsGrid = ({
  result,
  executedSql,
  onLoadMore,
}: ResultsGridProps) => {
  const { settings: exportSettings } = useExportSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: [],
    right: [],
  });
  const [expandedCell, setExpandedCell] = useState<{
    column: string;
    value: string;
  } | null>(null);
  const [detailRowIndex, setDetailRowIndex] = useState<number | null>(null);
  const [isScrolledX, setIsScrolledX] = useState(false);

  const columns = useResultsColumns(result.columns);

  const table = useReactTable({
    columnResizeMode: "onChange",
    columns,
    data: result.rows,
    defaultColumn: { minSize: 60, size: 180 },
    enableRowSelection: true,
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { columnPinning, rowSelection, sorting },
  });

  const { rows: sortedRows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    estimateSize: () => BODY_ROW_HEIGHT,
    getItemKey: (index) => sortedRows[index]?.index ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 12,
  });

  const selection = useRowSelection({
    containerRef: scrollRef,
    result,
    rowSelection,
    setRowSelection,
    table,
  });

  const autoSize = useColumnAutoSize({ gridRef, table });

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

  const openDetailForActive = useCallback(() => {
    if (selection.activeIndex !== null) {
      setDetailRowIndex(selection.activeIndex);
    }
  }, [selection.activeIndex]);

  useEffect(() => {
    selection.resetSelection();
    setSorting([]);
    setColumnPinning({ left: [], right: [] });
    setExpandedCell(null);
    setDetailRowIndex(null);
    setIsScrolledX(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const handleScroll = () => setIsScrolledX(el.scrollLeft > 0);
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useGridHotkeys({
    containerRef: scrollRef,
    handleKeyboardCopy: selection.handleKeyboardCopy,
    moveActive: selection.moveActive,
    moveActiveColumn: selection.moveActiveColumn,
    openDetailForActive,
    selectAll: selection.selectAll,
    toggleActiveSelection: selection.toggleActiveSelection,
  });

  useEffect(() => {
    if (selection.activeIndex === null) {
      return;
    }
    const sortedPos = sortedRows.findIndex(
      (r) => r.index === selection.activeIndex
    );
    if (sortedPos !== -1) {
      rowVirtualizer.scrollToIndex(sortedPos, { align: "auto" });
    }
  }, [selection.activeIndex, sortedRows, rowVirtualizer]);

  const isEmpty = sortedRows.length === 0;

  return (
    <div className="group/results flex h-full flex-col">
      <div
        className="group/grid relative flex-1 overflow-auto outline-none"
        data-scrolled-x={isScrolledX ? "" : undefined}
        ref={scrollRef}
        tabIndex={-1}
      >
        {isEmpty ? (
          <NoResultsState label="rows" />
        ) : (
          <div
            aria-colcount={result.columns.length}
            aria-rowcount={result.rowCount + 1}
            ref={gridRef}
            role="grid"
            style={{ minWidth: "100%", width: table.getTotalSize() }}
          >
            <ResultsGridHeader
              onFitAllColumns={autoSize.handleFitAllColumns}
              onFitColumn={autoSize.handleFitColumn}
              table={table}
            />
            <ResultsGridBody
              activeColumnIndex={selection.activeColumnIndex}
              activeIndex={selection.activeIndex}
              executedSql={executedSql}
              exportSettings={exportSettings}
              onExpandCell={setExpandedCell}
              onRowClick={selection.handleRowClick}
              result={result}
              selectedRowIndices={selection.selectedRowIndices}
              table={table}
              virtualizer={rowVirtualizer}
            />
          </div>
        )}
      </div>
      <ResultsGridFooter
        onLoadMore={onLoadMore}
        result={result}
        selectedCount={selection.selectedRowIndices.length}
      />
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
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-foreground text-xs leading-relaxed">
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
