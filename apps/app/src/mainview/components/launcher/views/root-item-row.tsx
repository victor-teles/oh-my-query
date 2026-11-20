import type { WidgetWatching } from "@/components/widgets/widget-row";
import type { DatabaseConnection } from "@/lib/connections";

import { BoardRow } from "@/components/board/board-row";
import { AskRow } from "@/components/launcher/ask-row";
import { CommandRow } from "@/components/launcher/command-row";
import { ConnectionRow } from "@/components/launcher/connections/connection-row";
import { TableRow } from "@/components/launcher/schema/table-row";
import { SqlRow } from "@/components/launcher/sql-row";
import { LookupRow } from "@/components/lookup/lookup-row";
import { AlertRow } from "@/components/watches/alert-row";
import { RecentRow } from "@/components/widgets/recent-row";
import { WidgetRow } from "@/components/widgets/widget-row";

import type { RootItem } from "./root-items";

export interface RootRowContext {
  selectedId: string | null;
  armedId: string | null;
  freshWidgetId: string | null;
  connectionById: (id: string) => DatabaseConnection | null;
  watchingFor: (widgetId: string) => WidgetWatching;
  onPulseDone: () => void;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

interface RootItemRowProps {
  item: RootItem;
  context: RootRowContext;
}

export function RootItemRow({ item, context }: RootItemRowProps) {
  const { onHover, onRun } = context;
  const selected = item.id === context.selectedId;
  const tone = item.id === context.armedId ? "destructive" : "default";
  switch (item.kind) {
    case "widget": {
      return (
        <WidgetRow
          connection={context.connectionById(item.widget.connectionId)}
          events={{
            onHover,
            onPulseDone:
              item.widget.id === context.freshWidgetId
                ? context.onPulseDone
                : undefined,
            onRun,
          }}
          id={item.id}
          selected={selected}
          watching={context.watchingFor(item.widget.id)}
          widget={item.widget}
        />
      );
    }
    case "alert": {
      return (
        <AlertRow
          alert={item.alert}
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
        />
      );
    }
    case "board": {
      return (
        <BoardRow
          board={item.board}
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
          tone={tone}
        />
      );
    }
    case "recent": {
      return (
        <RecentRow
          ask={item.ask}
          connectionName={
            context.connectionById(item.ask.connectionId)?.name ?? null
          }
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
        />
      );
    }
    case "ask": {
      return (
        <AskRow
          connection={item.connection}
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          prompt={item.prompt}
          selected={selected}
        />
      );
    }
    case "sql": {
      return (
        <SqlRow
          connection={item.connection}
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
          sql={item.sql}
        />
      );
    }
    case "table": {
      return (
        <TableRow
          id={item.id}
          onHover={onHover}
          onRun={onRun}
          schema={item.schema}
          selected={selected}
          table={item.table}
        />
      );
    }
    case "lookup": {
      return (
        <LookupRow
          offer={item}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
          variant={item.origin}
        />
      );
    }
    case "connection": {
      return (
        <ConnectionRow
          connection={item.connection}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
          tone={tone}
        />
      );
    }
    default: {
      return (
        <CommandRow
          command={item.command}
          onHover={onHover}
          onRun={onRun}
          selected={selected}
        />
      );
    }
  }
}
