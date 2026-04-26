import type { Row } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { memo, useMemo } from "react";

import type { ExportSettings } from "@/lib/export-settings";
import type { TabularResult } from "@/lib/tauri";

import { ResultsRowContextMenu } from "@/components/workspace/results-row-context-menu";

import type { ResultsColumnMeta } from "./-hooks/use-results-columns";

import { getColumnPinFacts } from "./-hooks/use-column-pin-style";
import { ResultsGridCell } from "./results-grid-cell";

interface ResultsGridRowProps {
  row: Row<unknown[]>;
  result: TabularResult;
  executedSql: string | null;
  exportSettings: ExportSettings;
  selectedRowIndices: number[];
  isActive: boolean;
  activeColumnIndex: number | null;
  sortedIndex: number;
  top: number;
  height: number;
  width: number;
  onRowClick: (
    event: MouseEvent,
    rowIndex: number,
    columnIndex?: number
  ) => void;
  onExpandCell: (cell: { column: string; value: string }) => void;
}

const ResultsGridRowBase = ({
  row,
  result,
  executedSql,
  exportSettings,
  selectedRowIndices,
  isActive,
  activeColumnIndex,
  sortedIndex,
  top,
  height,
  width,
  onRowClick,
  onExpandCell,
}: ResultsGridRowProps) => {
  const style = useMemo(
    () => ({
      height,
      left: 0,
      position: "absolute" as const,
      top: 0,
      transform: `translateY(${top}px)`,
      width,
    }),
    [height, top, width]
  );

  const cells = row.getVisibleCells();

  return (
    <ResultsRowContextMenu
      executedSql={executedSql}
      exportSettings={exportSettings}
      isActive={isActive}
      isSelected={row.getIsSelected()}
      onRowClick={onRowClick}
      result={result}
      rowIndex={row.index}
      selectedRowIndices={selectedRowIndices}
      sortedIndex={sortedIndex}
      style={style}
    >
      {cells.map((cell) => {
        const meta = cell.column.columnDef.meta as
          | ResultsColumnMeta
          | undefined;
        const columnIndex = meta?.columnIndex ?? 0;
        const facts = getColumnPinFacts(cell.column);
        return (
          <ResultsGridCell
            columnIndex={columnIndex}
            columnName={cell.column.id}
            columnType={meta?.typeName ?? ""}
            isActive={isActive && activeColumnIndex === columnIndex}
            isFirstRightPin={facts.isFirstRight}
            isLastLeftPin={facts.isLastLeft}
            key={cell.id}
            onActivate={onRowClick}
            onExpand={onExpandCell}
            pinOffset={facts.offset}
            pinned={facts.pinned}
            rowIndex={row.index}
            value={cell.getValue()}
            width={cell.column.getSize()}
          />
        );
      })}
    </ResultsRowContextMenu>
  );
};

export const ResultsGridRow = memo(ResultsGridRowBase);
