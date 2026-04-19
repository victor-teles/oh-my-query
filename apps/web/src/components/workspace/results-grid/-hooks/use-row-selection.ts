import type { RowSelectionState, Table } from "@tanstack/react-table";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { TabularResult } from "@/lib/tauri";

import { formatCell, isNull } from "@/lib/format-cell";
import { rowsToTsv } from "@/lib/row-serializers";

interface UseRowSelectionArgs {
  result: TabularResult;
  table: Table<unknown[]>;
  containerRef: RefObject<HTMLDivElement | null>;
  rowSelection: RowSelectionState;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
}

export interface RowSelectionApi {
  activeIndex: number | null;
  activeColumnIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  setActiveColumnIndex: Dispatch<SetStateAction<number | null>>;
  lastSelectedIndex: number | null;
  setLastSelectedIndex: Dispatch<SetStateAction<number | null>>;
  selectedRowIndices: number[];
  handleRowClick: (
    event: MouseEvent,
    rowIndex: number,
    columnIndex?: number
  ) => void;
  moveActive: (direction: 1 | -1, extend: boolean) => void;
  moveActiveColumn: (direction: 1 | -1) => void;
  toggleActiveSelection: () => void;
  selectAll: () => void;
  handleKeyboardCopy: () => void;
  resetSelection: () => void;
}

export const useRowSelection = ({
  result,
  table,
  containerRef,
  rowSelection,
  setRowSelection,
}: UseRowSelectionArgs): RowSelectionApi => {
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeColumnIndex, setActiveColumnIndex] = useState<number | null>(
    null
  );

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
  }, [result.rows.length, setRowSelection]);

  const handleRowClick = useCallback(
    (event: MouseEvent, rowIndex: number, columnIndex?: number) => {
      containerRef.current?.focus();
      setActiveIndex(rowIndex);
      if (columnIndex !== undefined) {
        setActiveColumnIndex(columnIndex);
      }
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
    [lastSelectedIndex, containerRef, setRowSelection]
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
    [table, activeIndex, lastSelectedIndex, containerRef, setRowSelection]
  );

  const moveActiveColumn = useCallback(
    (direction: 1 | -1) => {
      const columnCount = result.columns.length;
      if (columnCount === 0) {
        return;
      }
      containerRef.current?.focus();
      setActiveColumnIndex((prev) => {
        const curr = prev ?? (direction === 1 ? -1 : columnCount);
        return Math.max(0, Math.min(columnCount - 1, curr + direction));
      });
    },
    [result.columns.length, containerRef]
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
  }, [activeIndex, setRowSelection]);

  const handleKeyboardCopy = useCallback(() => {
    if (
      activeColumnIndex !== null &&
      activeIndex !== null &&
      selectedRowIndices.length <= 1
    ) {
      const row = result.rows[activeIndex];
      const value = row?.[activeColumnIndex];
      const text = isNull(value) ? "" : formatCell(value);
      navigator.clipboard.writeText(text);
      toast.success("Copied cell value");
      return;
    }
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
  }, [selectedRowIndices, activeIndex, activeColumnIndex, result]);

  const resetSelection = useCallback(() => {
    setRowSelection({});
    setLastSelectedIndex(null);
    setActiveIndex(null);
    setActiveColumnIndex(null);
  }, [setRowSelection]);

  return {
    activeColumnIndex,
    activeIndex,
    handleKeyboardCopy,
    handleRowClick,
    lastSelectedIndex,
    moveActive,
    moveActiveColumn,
    resetSelection,
    selectAll,
    selectedRowIndices,
    setActiveColumnIndex,
    setActiveIndex,
    setLastSelectedIndex,
    toggleActiveSelection,
  };
};
