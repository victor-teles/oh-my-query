import type { RowSelectionState } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TabularResult } from "@/lib/tauri";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExportSettings } from "@/hooks/use-export-settings";

import { ResultsPagination } from "./results-pagination";
import { ResultsRowContextMenu } from "./results-row-context-menu";

interface ResultsTableProps {
  result: TabularResult;
  executedSql: string | null;
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
};

const isNull = (value: unknown): boolean =>
  value === null || value === undefined;

const isNumber = (value: unknown): boolean => typeof value === "number";

export const ResultsTable = ({ result, executedSql }: ResultsTableProps) => {
  const { settings: exportSettings } = useExportSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    setRowSelection({});
    setLastSelectedIndex(null);
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
          return formatCell(value);
        },
        header: col.name,
        id: col.name,
        meta: { typeName: col.typeName },
      })),
    [result.columns]
  );

  const table = useReactTable({
    columns,
    data: result.rows,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
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
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    <div className="flex flex-col gap-0.5">
                      <span>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </span>
                      <span className="text-[0.6rem] font-normal text-muted-foreground">
                        {(header.column.columnDef.meta as { typeName: string })
                          ?.typeName ?? ""}
                      </span>
                    </div>
                  </TableHead>
                ))}
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
                  onRowClick={handleRowClick}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        isNumber(cell.getValue())
                          ? "text-right tabular-nums"
                          : ""
                      }
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
        {isEmpty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground">
            <SearchX className="size-5" />
            <span className="text-sm">No results</span>
            <span className="text-xs">Your query returned no rows</span>
          </div>
        )}
      </div>
      {table.getPageCount() > 1 && <ResultsPagination table={table} />}
    </div>
  );
};
