import {
  ChevronRight,
  Eye,
  KeyRound,
  Link,
  ListOrdered,
  Play,
  Star,
  Table2,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import type { TableItem, ViewItem } from "@/lib/tauri";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorInsert } from "@/contexts/editor-insert-context";

import { ColumnNode } from "./column-node";
import { TableContextMenu } from "./table-context-menu";

interface TableNodeProps {
  table: TableItem | ViewItem;
  isView?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (tableName: string) => void;
  highlightMatches?: number[];
}

const isTableItem = (item: TableItem | ViewItem): item is TableItem =>
  "indexes" in item;

const HIGHLIGHT_CLASS =
  "bg-primary/20 text-foreground rounded-[2px] px-px -mx-px";

interface HighlightSegment {
  text: string;
  matched: boolean;
  start: number;
}

const buildSegments = (text: string, matches: number[]): HighlightSegment[] => {
  if (matches.length === 0) {
    return [{ matched: false, start: 0, text }];
  }
  const matchSet = new Set(matches);
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const matched = matchSet.has(cursor);
    let end = cursor + 1;
    while (end < text.length && matchSet.has(end) === matched) {
      end += 1;
    }
    segments.push({
      matched,
      start: cursor,
      text: text.slice(cursor, end),
    });
    cursor = end;
  }
  return segments;
};

const HighlightedText = ({
  text,
  matches,
}: {
  text: string;
  matches: number[];
}) => {
  const segments = useMemo(() => buildSegments(text, matches), [text, matches]);
  return (
    <>
      {segments.map((seg) =>
        seg.matched ? (
          <mark className={HIGHLIGHT_CLASS} key={seg.start}>
            {seg.text}
          </mark>
        ) : (
          <span key={seg.start}>{seg.text}</span>
        )
      )}
    </>
  );
};

const numberFormatter = new Intl.NumberFormat();

const formatRowEstimate = (n: number | null = 0): string => {
  const value = n ?? 0;
  if (value === 0) {
    return "0 rows";
  }
  return `~ ${numberFormatter.format(value)} rows`;
};

const QuickPeek = ({ table }: { table: TableItem }) => {
  const pkColumns = table.columns
    .filter((c) => c.isPrimaryKey)
    .map((c) => c.name);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium">
        <Table2 className="size-3.5 text-muted-foreground" />
        <span className="truncate">{table.name}</span>
      </div>
      <div className="border-t border-border/60" />
      <div className="text-muted-foreground">
        {formatRowEstimate(table.rowEstimate)}
      </div>
      <div className="text-muted-foreground">
        {table.columns.length} columns &bull; {table.indexes.length} indexes
      </div>
      {pkColumns.length > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <KeyRound className="size-3 text-amber-500" />
          <span className="truncate">PK: {pkColumns.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

export const TableNode = ({
  table,
  isView = false,
  isFavorite = false,
  onToggleFavorite,
  highlightMatches,
}: TableNodeProps) => {
  const { queryTable } = useEditorInsert();
  const tableData = isTableItem(table) ? table : null;
  const hasIndexes = tableData ? tableData.indexes.length > 0 : false;
  const hasForeignKeys = tableData ? tableData.foreignKeys.length > 0 : false;

  const handleQueryTable = useCallback(() => {
    queryTable(table.name);
  }, [queryTable, table.name]);

  const handleToggleFavorite = useCallback(
    (name: string) => {
      onToggleFavorite?.(name);
    },
    [onToggleFavorite]
  );

  const triggerRow = (
    <div className="flex items-center">
      <CollapsibleTrigger
        className="
          flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs
          hover:bg-sidebar-accent/50
          [&[data-panel-open]>svg:first-child]:rotate-90
        "
      >
        <ChevronRight
          className="
          size-3 shrink-0 text-muted-foreground transition-transform
        "
        />
        {isView ? (
          <Eye className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">
          {highlightMatches && highlightMatches.length > 0 ? (
            <HighlightedText matches={highlightMatches} text={table.name} />
          ) : (
            table.name
          )}
        </span>
        {isFavorite && (
          <Star className="size-2.5 shrink-0 fill-amber-400 text-amber-400" />
        )}
      </CollapsibleTrigger>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="
                mr-1 rounded-sm p-0.5 text-muted-foreground opacity-0
                group-hover/table:opacity-100
                hover:bg-sidebar-accent/50 hover:text-sidebar-foreground
              "
              onClick={handleQueryTable}
              aria-label={`Query ${table.name}`}
            />
          }
        >
          <Play className="size-3" />
        </TooltipTrigger>
        <TooltipContent>Query table</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <TableContextMenu
      isFavorite={isFavorite}
      isView={isView}
      onToggleFavorite={handleToggleFavorite}
      table={table}
    >
      <Collapsible className="group/table">
        {tableData ? (
          <HoverCard>
            <HoverCardTrigger render={triggerRow} />
            <HoverCardContent align="start" side="right">
              <QuickPeek table={tableData} />
            </HoverCardContent>
          </HoverCard>
        ) : (
          triggerRow
        )}
        <CollapsibleContent>
          <div className="ml-3 border-l border-sidebar-border pl-2">
            <div className="text-section-label mt-1 mb-0.5 px-2">
              Columns ({table.columns.length})
            </div>
            {table.columns.map((col) => (
              <ColumnNode column={col} key={col.name} />
            ))}

            {hasIndexes && tableData && (
              <>
                <div className="text-section-label mt-2 mb-0.5 px-2">
                  Indexes ({tableData.indexes.length})
                </div>
                {tableData.indexes.map((idx) => (
                  <div
                    className="
                      flex items-center gap-2 px-2 py-1 text-xs
                      text-muted-foreground
                    "
                    key={idx.name}
                  >
                    <ListOrdered className="size-3 shrink-0" />
                    <span className="truncate">{idx.name}</span>
                    {idx.isUnique && (
                      <span
                        className="
                          ml-auto shrink-0 text-[10px] text-amber-500/70
                        "
                      >
                        unique
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            {hasForeignKeys && tableData && (
              <>
                <div className="text-section-label mt-2 mb-0.5 px-2">
                  Foreign Keys ({tableData.foreignKeys.length})
                </div>
                {tableData.foreignKeys.map((fk) => (
                  <div
                    className="
                      flex items-center gap-2 px-2 py-1 text-xs
                      text-muted-foreground
                    "
                    key={fk.name}
                  >
                    <Link className="size-3 shrink-0" />
                    <span className="truncate">
                      {fk.columns.join(", ")} &rarr; {fk.referencedTable}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </TableContextMenu>
  );
};
