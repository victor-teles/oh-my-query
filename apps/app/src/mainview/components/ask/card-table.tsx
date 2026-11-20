import type { CardResult } from "@conch/rpc";

import {
  columnValues,
  formatContextFor,
  formatFor,
  formatValue,
} from "@conch/rpc";

import type { CardSpec } from "@/lib/ipc";

import { isNumericColumn } from "@/lib/card-data";
import { segmentOfRow } from "@/lib/drill";
import { cn } from "@/lib/utils";

import { useRowDrill } from "./use-row-drill";

export const TABLE_ROW_LIMIT = 200;

interface CardTableProps {
  result: CardResult;
  formats: CardSpec["formats"];
  columns?: readonly string[];
}

const countFormat = new Intl.NumberFormat("en-US");

const summaryOf = (result: CardResult, shown: number): string | null => {
  if (shown >= result.rowCount && !result.isTruncated) {
    return null;
  }
  const total = `${countFormat.format(result.rowCount)}${result.isTruncated ? "+" : ""}`;
  return `Showing ${countFormat.format(shown)} of ${total}`;
};

export function CardTable({ result, formats, columns }: CardTableProps) {
  const visible = result.columns.filter(
    (column) => !columns || columns.includes(column.name)
  );
  const shapes = visible.map((column) => {
    const values = columnValues(result, column.name);
    return {
      context: formatContextFor(values),
      format: formatFor({ formats }, column.name, values),
      index: result.columns.indexOf(column),
      name: column.name,
      numeric: isNumericColumn(result, column.name),
    };
  });
  const rows = result.rows.slice(0, TABLE_ROW_LIMIT);
  const drill = useRowDrill((index) => segmentOfRow(result, index, columns));
  const summary = summaryOf(result, rows.length);

  return (
    <div className="px-2 pb-2">
      <div className="max-h-[248px] overflow-auto rounded-[8px]">
        <table className="w-full border-collapse type-meta tabular-nums">
          <thead className="sticky top-0 bg-(--panel-solid)">
            <tr>
              {shapes.map((shape) => (
                <th
                  className={cn(
                    "border-b border-panel-border px-2 py-1.5 font-medium text-panel-muted",
                    shape.numeric ? "text-right" : "text-left"
                  )}
                  key={shape.name}
                  scope="col"
                >
                  {shape.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                className={cn(
                  "hover:bg-row-hover",
                  drill &&
                    "cursor-pointer outline-none focus-visible:bg-row-active active:opacity-85"
                )}
                // Result rows have no identity; their order is the query's.
                // oxlint-disable-next-line react/no-array-index-key
                key={rowIndex}
                {...drill?.rowProps(rowIndex)}
              >
                {shapes.map((shape) => (
                  <td
                    className={cn(
                      "max-w-64 truncate px-2 py-1 text-foreground",
                      shape.numeric && "text-right"
                    )}
                    key={shape.name}
                  >
                    {formatValue(row[shape.index], shape.format, shape.context)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary ? (
        <p className="px-2 pt-2 type-micro text-panel-muted">{summary}</p>
      ) : null}
    </div>
  );
}
