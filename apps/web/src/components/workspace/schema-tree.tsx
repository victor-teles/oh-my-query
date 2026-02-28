import { useMemo } from "react";

import type { DatabaseType } from "@/lib/connections";
import type { SchemaInfo, SchemaItem } from "@/lib/tauri";

import { TableNode } from "./table-node";

interface SchemaTreeProps {
  schema: SchemaInfo;
  filter: string;
  pinnedTables: string[];
  onTogglePin: (tableName: string) => void;
  connectionId: string;
  databaseType: DatabaseType;
  onRefreshSchema: () => void;
}

const filterSchema = (schema: SchemaItem, query: string): SchemaItem => {
  const lower = query.toLowerCase();
  return {
    ...schema,
    tables: schema.tables.filter((t) => t.name.toLowerCase().includes(lower)),
    views: schema.views.filter((v) => v.name.toLowerCase().includes(lower)),
  };
};

export const SchemaTree = ({
  schema,
  filter,
  pinnedTables,
  onTogglePin,
  connectionId,
  databaseType,
  onRefreshSchema,
}: SchemaTreeProps) => {
  const filtered = useMemo(() => {
    const [first] = schema.schemas;
    if (!first) {
      return null;
    }
    return filter ? filterSchema(first, filter) : first;
  }, [schema, filter]);

  const sortedTables = useMemo(() => {
    if (!filtered) {
      return [];
    }
    return [...filtered.tables].toSorted((a, b) => {
      const aPinned = pinnedTables.includes(a.name);
      const bPinned = pinnedTables.includes(b.name);
      if (aPinned && !bPinned) {
        return -1;
      }
      if (!aPinned && bPinned) {
        return 1;
      }
      return 0;
    });
  }, [filtered, pinnedTables]);

  if (
    !filtered ||
    (filtered.tables.length === 0 && filtered.views.length === 0)
  ) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        No tables or views found
      </div>
    );
  }

  return (
    <div className="px-1 py-1">
      {sortedTables.length > 0 && (
        <>
          <div className="mb-0.5 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tables ({sortedTables.length})
          </div>
          {sortedTables.map((table) => (
            <TableNode
              key={table.name}
              table={table}
              isPinned={pinnedTables.includes(table.name)}
              onTogglePin={onTogglePin}
              connectionId={connectionId}
              databaseType={databaseType}
              onRefreshSchema={onRefreshSchema}
            />
          ))}
        </>
      )}

      {filtered.views.length > 0 && (
        <>
          <div className="mb-0.5 mt-3 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Views ({filtered.views.length})
          </div>
          {filtered.views.map((view) => (
            <TableNode
              key={view.name}
              table={view}
              isView
              connectionId={connectionId}
              databaseType={databaseType}
              onRefreshSchema={onRefreshSchema}
            />
          ))}
        </>
      )}
    </div>
  );
};
