import { useMemo } from "react";

import type { SchemaInfo, SchemaItem } from "@/lib/tauri";

import { TableNode } from "./table-node";

const LABEL_MIN_ITEMS = 6;

interface SchemaTreeProps {
  schema: SchemaInfo;
  filter: string;
  pinnedTables: string[];
  onTogglePin: (tableName: string) => void;
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

  const hasTables = sortedTables.length > 0;
  const hasViews = filtered.views.length > 0;
  const showBothLabels = hasTables && hasViews;
  const showTablesLabel =
    showBothLabels || sortedTables.length >= LABEL_MIN_ITEMS;
  const showViewsLabel =
    showBothLabels || filtered.views.length >= LABEL_MIN_ITEMS;

  return (
    <div className="px-1 py-1">
      {hasTables && (
        <>
          {showTablesLabel && (
            <div className="mb-0.5 px-2 text-section-label">
              Tables ({sortedTables.length})
            </div>
          )}
          {sortedTables.map((table) => (
            <TableNode
              isPinned={pinnedTables.includes(table.name)}
              key={table.name}
              onTogglePin={onTogglePin}
              table={table}
            />
          ))}
        </>
      )}

      {hasViews && (
        <>
          {showViewsLabel && (
            <div className="mb-0.5 mt-3 px-2 text-section-label">
              Views ({filtered.views.length})
            </div>
          )}
          {filtered.views.map((view) => (
            <TableNode isView key={view.name} table={view} />
          ))}
        </>
      )}
    </div>
  );
};
