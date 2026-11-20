import { SquareTerminalIcon } from "lucide-react";

import type { DatabaseConnection } from "@/lib/connections";

import { SQL_TOKEN_CLASSES, tokenizeSql } from "@/lib/sql-highlight";
import { cn } from "@/lib/utils";

import { LauncherRow } from "./launcher-row";

interface SqlRowProps {
  id: string;
  sql: string;
  connection: DatabaseConnection;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function SqlRow({
  id,
  sql,
  connection,
  selected,
  onHover,
  onRun,
}: SqlRowProps) {
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      <span className="relative grid size-6 shrink-0 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <SquareTerminalIcon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2.5">
        <code className="min-w-0 truncate font-mono text-[12px]">
          {tokenizeSql(sql).map((token, index) => (
            <span
              className={cn(SQL_TOKEN_CLASSES[token.kind])}
              // Tokens are positional; the SQL text is the identity.
              // oxlint-disable-next-line react/no-array-index-key
              key={index}
            >
              {token.text}
            </span>
          ))}
        </code>
        <span className="shrink-0 type-meta text-panel-muted">
          Run on {connection.name} · read only
        </span>
      </span>
    </LauncherRow>
  );
}
