import { useCallback } from "react";

import type { NoticeAction } from "@/components/ask/error-notice";
import type { DatabaseConnection } from "@/lib/connections";

import { ErrorNotice } from "@/components/ask/error-notice";
import { ConnectionGlyph } from "@/components/launcher/connections/connection-glyph";
import { Pressable } from "@/components/motion/pressable";

import type { WidgetRunFailure } from "./widget-run-reducer";

type Remedy = "retry" | "choose-connection" | null;

interface FailureCopy {
  title: string;
  showDetail: boolean;
  remedy: Remedy;
}

const COPY: Record<string, FailureCopy> = {
  CONNECTION_MISSING: {
    remedy: "choose-connection",
    showDetail: false,
    title: "This widget's connection no longer exists.",
  },
  INVALID_INPUT: {
    remedy: null,
    showDetail: true,
    title: "One of the inputs isn't valid.",
  },
  NOT_READ_ONLY: {
    remedy: null,
    showDetail: true,
    title: "This widget would change data, so it can't run.",
  },
  QUERY_CANCELLED: { remedy: "retry", showDetail: false, title: "Stopped." },
  QUERY_TIMEOUT: {
    remedy: "retry",
    showDetail: false,
    title: "The query took longer than 30 seconds.",
  },
  UNSUPPORTED_ENGINE: {
    remedy: null,
    showDetail: false,
    title: "Widgets work with SQL databases for now.",
  },
  WIDGET_NOT_FOUND: {
    remedy: null,
    showDetail: false,
    title: "This widget no longer exists.",
  },
};

const FALLBACK: FailureCopy = {
  remedy: "retry",
  showDetail: true,
  title: "The query failed.",
};

export const failureCopy = (failure: WidgetRunFailure): FailureCopy =>
  COPY[failure.code] ?? FALLBACK;

const SQL_ENGINES = new Set([
  "postgresql",
  "mysql",
  "sqlite",
  "duckdb",
  "mssql",
  "clickhouse",
]);

interface ConnectionChoiceProps {
  connection: DatabaseConnection;
  onChoose: (connectionId: string) => void;
}

function ConnectionChoice({ connection, onChoose }: ConnectionChoiceProps) {
  const handleClick = useCallback(
    () => onChoose(connection.id),
    [connection.id, onChoose]
  );
  return (
    <Pressable
      className="flex h-7 items-center gap-1.5 rounded-[7px] bg-row-hover px-2 type-meta text-foreground hover:bg-row-active"
      onClick={handleClick}
    >
      <ConnectionGlyph
        className="size-4 rounded-[5px] text-[10px]"
        connection={connection}
      />
      {connection.name}
    </Pressable>
  );
}

interface WidgetErrorProps {
  failure: WidgetRunFailure;
  connections: readonly DatabaseConnection[];
  onRetry: () => void;
  onRebind: (connectionId: string) => void;
}

export function WidgetError({
  failure,
  connections,
  onRetry,
  onRebind,
}: WidgetErrorProps) {
  const copy = failureCopy(failure);
  const action: NoticeAction | null =
    copy.remedy === "retry" ? { label: "Retry", onRun: onRetry } : null;
  const choices = connections.filter((connection) =>
    SQL_ENGINES.has(connection.type)
  );
  return (
    <ErrorNotice
      action={action}
      detail={copy.showDetail ? failure.message : null}
      title={copy.title}
    >
      {copy.remedy === "choose-connection" ? (
        <div
          aria-label="Choose a connection"
          className="mt-1 flex flex-wrap gap-1.5"
          role="group"
        >
          {choices.length === 0 ? (
            <p className="type-meta text-panel-muted">
              Add a SQL connection to run this widget.
            </p>
          ) : null}
          {choices.map((connection) => (
            <ConnectionChoice
              connection={connection}
              key={connection.id}
              onChoose={onRebind}
            />
          ))}
        </div>
      ) : null}
    </ErrorNotice>
  );
}
