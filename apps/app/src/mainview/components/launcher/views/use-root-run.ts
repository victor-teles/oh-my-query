import type { DialectType } from "@oh-my-query/core/client";

import { previewSql } from "@oh-my-query/core/client";
import { useCallback } from "react";

import type { RootAlert } from "@/components/watches/use-alerts";
import type { DatabaseConnection } from "@/lib/connections";
import type { LookupValue, ParamValues } from "@/lib/ipc";

import type { RootItem } from "./root-items";
import type { RootAskActions } from "./root-view";

export interface PreviewTarget {
  connectionId: string;
  dialect: DialectType;
}

interface UseRootRunOptions {
  items: readonly RootItem[];
  ask: RootAskActions;
  startLookup: (value: LookupValue, connectionId: string) => void;
  preview: PreviewTarget | null;
  runWidget: (widgetId: string, values: ParamValues) => void;
  openBoard: (boardId: string) => void;
  openAlert: (alert: RootAlert) => void;
  onActivate: (connection: DatabaseConnection) => void;
}

const targetOf = (connectionId: string, database: string | null = null) => ({
  connectionId,
  database,
});

export const useRootRun = ({
  items,
  ask,
  startLookup,
  preview,
  runWidget,
  openBoard,
  openAlert,
  onActivate,
}: UseRootRunOptions) => {
  const { start, startSql } = ask;
  const runItem = useCallback(
    (item: RootItem | null | undefined) => {
      switch (item?.kind) {
        case "ask": {
          start(item.prompt, targetOf(item.connection.id));
          return;
        }
        case "sql": {
          startSql(item.sql, targetOf(item.connection.id));
          return;
        }
        case "lookup": {
          startLookup(item.value, item.connection.id);
          return;
        }
        case "table": {
          if (preview) {
            const sql = previewSql(
              preview.dialect,
              item.schema,
              item.table.name
            );
            startSql(sql, targetOf(preview.connectionId), item.table.name);
          }
          return;
        }
        case "widget": {
          runWidget(item.widget.id, {});
          return;
        }
        case "board": {
          openBoard(item.board.id);
          return;
        }
        case "alert": {
          openAlert(item.alert);
          return;
        }
        case "recent": {
          start(
            item.ask.prompt,
            targetOf(item.ask.connectionId, item.ask.database)
          );
          return;
        }
        case "connection": {
          onActivate(item.connection);
          return;
        }
        case "command": {
          item.command.run();
          break;
        }
        default: {
          break;
        }
      }
    },
    [
      onActivate,
      openAlert,
      openBoard,
      preview,
      runWidget,
      start,
      startLookup,
      startSql,
    ]
  );
  const runById = useCallback(
    (id: string) => runItem(items.find((item) => item.id === id)),
    [items, runItem]
  );
  return { runById, runItem };
};
