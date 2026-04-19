import type { Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { MouseEvent } from "react";

import type { ExportSettings } from "@/lib/export-settings";
import type { TabularResult } from "@/lib/tauri";

import { ResultsGridRow } from "./results-grid-row";

interface ResultsGridBodyProps {
  table: Table<unknown[]>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  result: TabularResult;
  executedSql: string | null;
  exportSettings: ExportSettings;
  selectedRowIndices: number[];
  activeIndex: number | null;
  activeColumnIndex: number | null;
  onRowClick: (
    event: MouseEvent,
    rowIndex: number,
    columnIndex?: number
  ) => void;
  onExpandCell: (cell: { column: string; value: string }) => void;
}

export const ResultsGridBody = ({
  table,
  virtualizer,
  result,
  executedSql,
  exportSettings,
  selectedRowIndices,
  activeIndex,
  activeColumnIndex,
  onRowClick,
  onExpandCell,
}: ResultsGridBodyProps) => {
  const { rows } = table.getRowModel();
  const totalWidth = table.getTotalSize();

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        position: "relative",
        width: totalWidth,
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) {
          return null;
        }
        const isActive = row.index === activeIndex;
        return (
          <ResultsGridRow
            activeColumnIndex={isActive ? activeColumnIndex : null}
            executedSql={executedSql}
            exportSettings={exportSettings}
            height={virtualRow.size}
            isActive={isActive}
            key={virtualRow.key}
            onExpandCell={onExpandCell}
            onRowClick={onRowClick}
            result={result}
            row={row}
            selectedRowIndices={selectedRowIndices}
            sortedIndex={virtualRow.index}
            top={virtualRow.start}
            width={totalWidth}
          />
        );
      })}
    </div>
  );
};
