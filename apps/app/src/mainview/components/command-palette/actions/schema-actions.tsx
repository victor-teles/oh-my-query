import { RefreshCwIcon, TableIcon } from "lucide-react";
import { useMemo } from "react";

import type { CommandAction } from "@/components/command-palette/types";
import type { SchemaInfo } from "@/lib/tauri";

import { useRegisterCommandActions } from "@/components/command-palette/use-register-command-actions";

interface SchemaActionsProps {
  schema: SchemaInfo | null;
  onRefresh: () => void;
  onQueryTable: (tableName: string) => void;
}

export const SchemaActions = ({
  schema,
  onRefresh,
  onQueryTable,
}: SchemaActionsProps) => {
  const actions = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [
      {
        group: "Schema",
        icon: RefreshCwIcon,
        id: "schema.refresh",
        keywords: ["reload"],
        label: "Refresh Schema",
        perform: onRefresh,
        shortcut: ["F5"],
      },
    ];

    if (!schema) {
      return list;
    }

    for (const schemaItem of schema.schemas) {
      for (const table of schemaItem.tables) {
        list.push({
          group: "Schema",
          icon: TableIcon,
          id: `schema.query-table.${schemaItem.name}.${table.name}`,
          keywords: ["select", "table", schemaItem.name],
          label: `Query ${table.name}`,
          perform: () => onQueryTable(table.name),
        });
      }
      for (const view of schemaItem.views) {
        list.push({
          group: "Schema",
          icon: TableIcon,
          id: `schema.query-view.${schemaItem.name}.${view.name}`,
          keywords: ["select", "view", schemaItem.name],
          label: `Query ${view.name}`,
          perform: () => onQueryTable(view.name),
        });
      }
    }

    return list;
  }, [schema, onRefresh, onQueryTable]);

  useRegisterCommandActions(actions, [actions]);

  return null;
};
