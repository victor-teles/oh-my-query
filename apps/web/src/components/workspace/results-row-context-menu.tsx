import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { Braces, Copy, FileCode, Hash, LetterText, Sheet } from "lucide-react";
import { useCallback } from "react";

import type { ExportSettings } from "@/lib/export-settings";
import type { TabularResult } from "@/lib/tauri";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  extractTableName,
  rowsToCsv,
  rowsToInserts,
  rowsToJson,
  rowsToMarkdown,
  rowsToMultiRowInsert,
  rowsToTsv,
} from "@/lib/row-serializers";

interface ResultsRowContextMenuProps {
  result: TabularResult;
  executedSql: string | null;
  rowIndex: number;
  sortedIndex: number;
  selectedRowIndices: number[];
  exportSettings: ExportSettings;
  isSelected: boolean;
  isActive: boolean;
  onRowClick: (event: MouseEvent, rowIndex: number) => void;
  style?: CSSProperties;
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
  sortedIndex,
  selectedRowIndices,
  exportSettings,
  isSelected,
  isActive,
  onRowClick,
  style,
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

  const handleCopyMultiRowInsert = useCallback(() => {
    const tableName = extractTableName(executedSql) ?? undefined;
    copy(
      rowsToMultiRowInsert(
        buildSlice(result, rowIndex, selectedRowIndices),
        tableName
      )
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
          // oxlint-disable-next-line eslint-plugin-jsx-a11y(click-events-have-key-events)
          <div
            aria-rowindex={sortedIndex + 2}
            aria-selected={isSelected}
            className="flex cursor-default border-border/40 border-b transition-colors hover:bg-muted/50 data-[active]:shadow-[inset_2px_0_0_0_var(--ring)] data-[state=selected]:bg-muted"
            data-active={isActive ? "" : undefined}
            data-row-index={rowIndex}
            data-state={isSelected ? "selected" : undefined}
            onClick={handleClick}
            role="row"
            style={style}
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
            <ContextMenuGroup>
              <ContextMenuLabel>Tabular</ContextMenuLabel>
              <ContextMenuItem onClick={handleCopyCsv}>
                <Sheet />
                CSV
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopyTsv}>
                <Hash />
                TSV
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopyMarkdown}>
                <LetterText />
                Markdown
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>SQL</ContextMenuLabel>
              <ContextMenuItem onClick={handleCopyInsert}>
                <FileCode />
                INSERT
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopyMultiRowInsert}>
                <FileCode />
                INSERT (multi-row)
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>JSON</ContextMenuLabel>
              <ContextMenuItem onClick={handleCopyJson}>
                <Braces />
                JSON
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
};
