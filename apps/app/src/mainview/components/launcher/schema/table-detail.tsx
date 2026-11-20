import type { TableItem } from "@conch/core/client";

import { KeyRoundIcon } from "lucide-react";

import { SwapText } from "@/components/motion/swap-text";

import {
  columnCountLabel,
  foreignTargets,
  rowEstimateLabel,
} from "./table-summary";

interface TableDetailProps {
  schema: string;
  table: TableItem;
}

export function TableDetail({ schema, table }: TableDetailProps) {
  const targets = foreignTargets(table);
  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="truncate font-mono text-[13px] text-foreground">
          {table.name}
        </h3>
        <p className="flex gap-1.5 type-meta text-panel-muted tabular-nums">
          <span>{schema}</span>
          <span aria-hidden>·</span>
          <SwapText value={rowEstimateLabel(table.rowEstimate)} />
          <span aria-hidden>·</span>
          <span>{columnCountLabel(table)}</span>
        </p>
      </div>
      <ul aria-label="Columns" className="flex flex-col">
        {table.columns.map((column) => (
          <li
            className="flex h-6 items-center gap-2 font-mono text-[12px]"
            key={column.name}
          >
            <span className="flex w-3.5 shrink-0 justify-center">
              {column.isPrimaryKey ? (
                <KeyRoundIcon
                  aria-label="primary key"
                  className="size-3 text-primary"
                />
              ) : null}
            </span>
            <span className="min-w-0 truncate text-foreground">
              {column.name}
            </span>
            <span className="shrink-0 text-panel-muted">{column.dataType}</span>
            {column.isNullable ? (
              <span className="shrink-0 text-panel-muted">null</span>
            ) : null}
            {targets.has(column.name) ? (
              <span className="ml-auto shrink-0 truncate text-panel-muted">
                → {targets.get(column.name)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {table.indexes.length > 0 ? (
        <ul aria-label="Indexes" className="flex flex-col gap-1">
          {table.indexes.map((index) => (
            <li className="flex items-center gap-2 type-meta" key={index.name}>
              <span className="truncate font-mono text-[12px] text-foreground">
                {index.name}
              </span>
              <span className="truncate font-mono text-[12px] text-panel-muted">
                ({index.columns.join(", ")})
              </span>
              {index.isUnique ? (
                <span className="shrink-0 rounded-[5px] bg-row-hover px-1.5 type-micro text-panel-muted">
                  unique
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
