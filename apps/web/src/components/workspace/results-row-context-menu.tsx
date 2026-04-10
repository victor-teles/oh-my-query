import type { MouseEvent, ReactNode } from "react";

import { Braces, Copy, FileCode, Hash, LetterText, Sheet } from "lucide-react";
import { useCallback } from "react";

import type { ExportSettings } from "@/lib/export-settings";
import type { TabularResult } from "@/lib/tauri";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TableRow } from "@/components/ui/table";
import {
  extractTableName,
  rowsToCsv,
  rowsToInserts,
  rowsToJson,
  rowsToMarkdown,
  rowsToTsv,
} from "@/lib/row-serializers";

interface ResultsRowContextMenuProps {
  result: TabularResult;
  executedSql: string | null;
  rowIndex: number;
  selectedRowIndices: number[];
  exportSettings: ExportSettings;
  isSelected: boolean;
  onRowClick: (event: MouseEvent, rowIndex: number) => void;
  children: ReactNode;
}

const buildSlice = (
  result: TabularResult,
  rowIndex: number,
  selectedRowIndices: number[]
) => {
  const indices = selectedRowIndices.includes(rowIndex)
    ? [...selectedRowIndices].toSorted((a, b) => a - b)
    : [rowIndex];
  return {
    columns: result.columns,
    rows: indices.map((i) => result.rows[i] ?? []),
  };
};

const copy = (text: string): void => {
  navigator.clipboard.writeText(text);
};

export const ResultsRowContextMenu = ({
  result,
  executedSql,
  rowIndex,
  selectedRowIndices,
  exportSettings,
  isSelected,
  onRowClick,
  children,
}: ResultsRowContextMenuProps) => {
  const handleCopyCsv = useCallback(() => {
    copy(
      rowsToCsv(buildSlice(result, rowIndex, selectedRowIndices), {
        delimiter: exportSettings.csvDelimiter,
        includeBom: exportSettings.includeBom,
        includeHeaders: exportSettings.includeHeaders,
        nullDisplay: exportSettings.nullDisplay,
      })
    );
  }, [result, rowIndex, selectedRowIndices, exportSettings]);

  const handleCopyTsv = useCallback(() => {
    copy(rowsToTsv(buildSlice(result, rowIndex, selectedRowIndices)));
  }, [result, rowIndex, selectedRowIndices]);

  const handleCopyJson = useCallback(() => {
    copy(rowsToJson(buildSlice(result, rowIndex, selectedRowIndices)));
  }, [result, rowIndex, selectedRowIndices]);

  const handleCopyInsert = useCallback(() => {
    const tableName = extractTableName(executedSql) ?? undefined;
    copy(
      rowsToInserts(buildSlice(result, rowIndex, selectedRowIndices), tableName)
    );
  }, [result, executedSql, rowIndex, selectedRowIndices]);

  const handleCopyMarkdown = useCallback(() => {
    copy(rowsToMarkdown(buildSlice(result, rowIndex, selectedRowIndices)));
  }, [result, rowIndex, selectedRowIndices]);

  const handleClick = useCallback(
    (event: MouseEvent) => onRowClick(event, rowIndex),
    [onRowClick, rowIndex]
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <TableRow
            data-state={isSelected ? "selected" : undefined}
            className="cursor-default"
            onClick={handleClick}
          />
        }
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy />
            Copy as
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleCopyCsv}>
              <Sheet />
              CSV
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyTsv}>
              <Hash />
              TSV
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyJson}>
              <Braces />
              JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyInsert}>
              <FileCode />
              INSERT
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyMarkdown}>
              <LetterText />
              Markdown
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
};
