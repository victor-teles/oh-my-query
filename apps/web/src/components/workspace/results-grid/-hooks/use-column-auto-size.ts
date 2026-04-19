import type { Table } from "@tanstack/react-table";
import type { RefObject } from "react";

import { useCallback } from "react";

import { formatCell } from "@/lib/format-cell";

import type { ResultsColumnMeta } from "./use-results-columns";

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;
const CELL_HORIZONTAL_PADDING = 16;
const HEADER_ICON_GUTTER = 24;
const SAMPLE_THRESHOLD = 500;
const SAMPLE_HEAD = 100;
const SAMPLE_TAIL = 100;
const SAMPLE_RANDOM = 300;

const resolveCellFont = (gridEl: HTMLElement | null): string => {
  if (!gridEl) {
    return '13px "JetBrains Mono Variable", monospace';
  }
  const cell = gridEl.querySelector<HTMLElement>('[role="gridcell"]');
  if (!cell) {
    return '13px "JetBrains Mono Variable", monospace';
  }
  const computed = getComputedStyle(cell);
  return `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
};

const resolveHeaderFont = (gridEl: HTMLElement | null): string => {
  if (!gridEl) {
    return "600 12px system-ui, sans-serif";
  }
  const header = gridEl.querySelector<HTMLElement>(
    '[role="columnheader"] span'
  );
  if (!header) {
    return "600 12px system-ui, sans-serif";
  }
  const computed = getComputedStyle(header);
  return `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
};

const pickSampleIndices = (rowCount: number): number[] => {
  if (rowCount <= SAMPLE_THRESHOLD) {
    return Array.from({ length: rowCount }, (_, i) => i);
  }
  const picked = new Set<number>();
  for (let i = 0; i < SAMPLE_HEAD && i < rowCount; i += 1) {
    picked.add(i);
  }
  for (let i = 0; i < SAMPLE_TAIL; i += 1) {
    picked.add(rowCount - 1 - i);
  }
  while (picked.size < SAMPLE_HEAD + SAMPLE_TAIL + SAMPLE_RANDOM) {
    picked.add(Math.floor(Math.random() * rowCount));
  }
  return [...picked];
};

interface UseColumnAutoSizeArgs {
  table: Table<unknown[]>;
  gridRef: RefObject<HTMLDivElement | null>;
}

export interface ColumnAutoSizeApi {
  handleFitColumn: (columnId: string) => void;
  handleFitAllColumns: () => void;
}

export const useColumnAutoSize = ({
  table,
  gridRef,
}: UseColumnAutoSizeArgs): ColumnAutoSizeApi => {
  const measureColumn = useCallback(
    (columnId: string, ctx: CanvasRenderingContext2D): number => {
      const column = table.getColumn(columnId);
      if (!column) {
        return MIN_WIDTH;
      }
      const meta = column.columnDef.meta as ResultsColumnMeta | undefined;
      const { rows } = table.getCoreRowModel();
      const sampleIndices = pickSampleIndices(rows.length);

      const headerFont = resolveHeaderFont(gridRef.current);
      ctx.font = headerFont;
      const headerText =
        typeof column.columnDef.header === "string"
          ? column.columnDef.header
          : columnId;
      let maxWidth = ctx.measureText(headerText).width + HEADER_ICON_GUTTER;
      if (meta?.typeName) {
        const typeWidth = ctx.measureText(meta.typeName).width;
        if (typeWidth > maxWidth - HEADER_ICON_GUTTER) {
          maxWidth = typeWidth + HEADER_ICON_GUTTER;
        }
      }

      ctx.font = resolveCellFont(gridRef.current);
      for (const idx of sampleIndices) {
        const row = rows[idx];
        if (!row) {
          continue;
        }
        const raw = row.getValue(columnId);
        const formatted =
          raw === null || raw === undefined ? "NULL" : formatCell(raw);
        const firstLine = formatted.split("\n")[0] ?? formatted;
        const { width } = ctx.measureText(firstLine);
        if (width > maxWidth) {
          maxWidth = width;
        }
      }

      const final = maxWidth + CELL_HORIZONTAL_PADDING;
      return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.ceil(final)));
    },
    [table, gridRef]
  );

  const handleFitColumn = useCallback(
    (columnId: string) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      const next = measureColumn(columnId, ctx);
      table.setColumnSizing((prev) => ({ ...prev, [columnId]: next }));
    },
    [table, measureColumn]
  );

  const handleFitAllColumns = useCallback(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const sizing: Record<string, number> = {};
    for (const column of table.getAllLeafColumns()) {
      sizing[column.id] = measureColumn(column.id, ctx);
    }
    table.setColumnSizing((prev) => ({ ...prev, ...sizing }));
  }, [table, measureColumn]);

  return { handleFitAllColumns, handleFitColumn };
};
