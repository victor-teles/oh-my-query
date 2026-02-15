import { useMemo } from "react";

import type { SchemaInfo, SchemaItem } from "@/lib/tauri";

import { TableNode } from "./table-node";

interface SchemaTreeProps {
  schema: SchemaInfo;
  filter: string;
}

const filterSchema = (schema: SchemaItem, query: string): SchemaItem => {
  const lower = query.toLowerCase();
  return {
    ...schema,
    tables: schema.tables.filter((t) => t.name.toLowerCase().includes(lower)),
    views: schema.views.filter((v) => v.name.toLowerCase().includes(lower)),
  };
};

export const SchemaTree = ({ schema, filter }: SchemaTreeProps) => {
  const filtered = useMemo(() => {
    const [first] = schema.schemas;
    if (!first) {
      return null;
    }
    return filter ? filterSchema(first, filter) : first;
  }, [schema, filter]);

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
      {filtered.tables.length > 0 && (
        <>
          <div className="mb-0.5 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tables ({filtered.tables.length})
          </div>
          {filtered.tables.map((table) => (
            <TableNode key={table.name} table={table} />
          ))}
        </>
      )}

      {filtered.views.length > 0 && (
        <>
          <div className="mb-0.5 mt-3 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Views ({filtered.views.length})
          </div>
          {filtered.views.map((view) => (
            <TableNode key={view.name} table={view} isView />
          ))}
        </>
      )}
    </div>
  );
};
