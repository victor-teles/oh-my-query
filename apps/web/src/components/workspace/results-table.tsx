import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import type { QueryResult } from "@/lib/tauri";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ResultsPagination } from "./results-pagination";

interface ResultsTableProps {
  result: QueryResult;
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

export const ResultsTable = ({ result }: ResultsTableProps) => {
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
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
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
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      isNumber(cell.getValue()) ? "text-right tabular-nums" : ""
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {table.getPageCount() > 1 && <ResultsPagination table={table} />}
    </div>
  );
};
