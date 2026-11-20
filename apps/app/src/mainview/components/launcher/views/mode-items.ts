import type { LauncherInput } from "@/components/launcher/input-mode";
import type { CatalogTable } from "@/components/launcher/schema/table-search";
import type { DatabaseConnection } from "@/lib/connections";

import { filterConnections } from "@/components/launcher/connections/connection-search";
import { isSqlDatabase } from "@/lib/connections";

import type { RootItem, RootSection } from "./root-items";

export type ModeInput = Exclude<LauncherInput, { mode: "search" }>;

export interface ModeNote {
  tone: "hint" | "unsupported";
  text: string;
}

export interface ModeView {
  sections: RootSection[];
  note: ModeNote | null;
}

export const SQL_ITEM_ID = "sql";

const connectionItems = (
  connections: readonly DatabaseConnection[],
  needle: string
): RootItem[] =>
  filterConnections(connections, needle).map((connection) => ({
    connection,
    id: connection.id,
    kind: "connection",
  }));

const PICK_LABELS = {
  sql: "Pick a connection to run SQL",
  table: "Pick a connection to browse tables",
} as const;

const UNSUPPORTED = {
  sql: "SQL runs work with SQL databases.",
  table: "Table peek works with SQL databases.",
} as const;

const view = (sections: RootSection[], note: ModeNote | null = null) => ({
  note,
  sections,
});

interface ModeViewInput {
  input: ModeInput;
  connections: readonly DatabaseConnection[];
  active: DatabaseConnection | null;
  tables: readonly CatalogTable[];
}

export const modeView = ({
  input,
  connections,
  active,
  tables,
}: ModeViewInput): ModeView => {
  if (input.mode === "connection") {
    const items = connectionItems(connections, input.needle);
    return view(
      items.length > 0
        ? [{ id: "switch", items, label: "Switch connection" }]
        : []
    );
  }
  if (!active) {
    const items = connectionItems(connections, "");
    return items.length > 0
      ? view([{ id: "pick", items, label: PICK_LABELS[input.mode] }])
      : view([], { text: "Add a connection first.", tone: "hint" });
  }
  if (!isSqlDatabase(active.type)) {
    return view([], { text: UNSUPPORTED[input.mode], tone: "unsupported" });
  }
  if (input.mode === "table") {
    const items: RootItem[] = tables.map((entry) => ({
      id: entry.id,
      kind: "table",
      schema: entry.schema,
      table: entry.table,
    }));
    return view(
      items.length > 0 ? [{ id: "tables", items, label: "Tables" }] : []
    );
  }
  if (!input.sql) {
    return view([], {
      text: `Type a read-only query. ↵ runs it on ${active.name}.`,
      tone: "hint",
    });
  }
  return view([
    {
      id: "sql",
      items: [
        { connection: active, id: SQL_ITEM_ID, kind: "sql", sql: input.sql },
      ],
      label: "Run SQL",
    },
  ]);
};
