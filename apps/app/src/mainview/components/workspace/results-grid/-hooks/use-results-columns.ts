import type { ColumnDef, Row } from "@tanstack/react-table";

import { useMemo } from "react";

import type { ColumnInfo } from "@/lib/tauri";

import { compareValues } from "@/lib/format-cell";

export interface ResultsColumnMeta {
  typeName: string;
  columnIndex: number;
}

const sortingFn = (
  rowA: Row<unknown[]>,
  rowB: Row<unknown[]>,
  columnId: string
): number => compareValues(rowA.getValue(columnId), rowB.getValue(columnId));

export const useResultsColumns = (
  columns: ColumnInfo[]
): ColumnDef<unknown[]>[] =>
  useMemo(
    () =>
      columns.map((col, idx) => ({
        accessorFn: (row: unknown[]) => row[idx],
        header: col.name,
        id: col.name,
        meta: {
          columnIndex: idx,
          typeName: col.typeName,
        } satisfies ResultsColumnMeta,
        sortingFn,
      })),
    [columns]
  );
