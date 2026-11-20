import type { LookupValue, TableItem } from "@conch/core/client";

import type { LauncherCommand } from "@/components/launcher/root-commands";
import type { RootAlert } from "@/components/watches/use-alerts";
import type { DatabaseConnection } from "@/lib/connections";
import type { Board, RecentAsk, Widget } from "@/lib/ipc";

import { filterConnections } from "@/components/launcher/connections/connection-search";
import { filterCommands } from "@/components/launcher/root-commands";
import { filterWidgets } from "@/components/widgets/widget-search";

export type RootItem =
  | { kind: "command"; id: string; command: LauncherCommand }
  | { kind: "connection"; id: string; connection: DatabaseConnection }
  | { kind: "ask"; id: string; prompt: string; connection: DatabaseConnection }
  | { kind: "widget"; id: string; widget: Widget }
  | { kind: "recent"; id: string; ask: RecentAsk }
  | { kind: "board"; id: string; board: Board }
  | { kind: "alert"; id: string; alert: RootAlert }
  | { kind: "sql"; id: string; sql: string; connection: DatabaseConnection }
  | { kind: "table"; id: string; schema: string; table: TableItem }
  | {
      kind: "lookup";
      id: string;
      value: LookupValue;
      connection: DatabaseConnection;
      origin: LookupOrigin;
    };

export type LookupOrigin = "typed" | "clipboard";

export const ASK_ITEM_ID = "ask";
export const LOOKUP_ITEM_IDS: Record<LookupOrigin, string> = {
  clipboard: "lookup-clipboard",
  typed: "lookup",
};
export const RECENTS_SHOWN = 5;

export const widgetItemId = (widgetId: string) => `widget-${widgetId}`;
export const boardItemId = (boardId: string) => `board-${boardId}`;
export const alertItemId = (watchId: string) => `alert-${watchId}`;
const recentItemId = (askId: string) => `recent-${askId}`;

export interface RootSection {
  id:
    | "connections"
    | "ask"
    | "commands"
    | "recent"
    | "widgets"
    | "boards"
    | "sql"
    | "tables"
    | "switch"
    | "pick"
    | "lookup"
    | "clipboard"
    | "alerts";
  label: string;
  items: RootItem[];
}

interface BuildRootSectionsInput {
  query: string;
  connections: readonly DatabaseConnection[];
  commands: readonly LauncherCommand[];
  aiSetup: LauncherCommand | null;
  askWith?: DatabaseConnection | null;
  widgets?: readonly Widget[];
  recents?: readonly RecentAsk[];
  boards?: readonly Board[];
  lookup?: LookupValue | null;
  offer?: LookupValue | null;
  lookupWith?: DatabaseConnection | null;
  alerts?: readonly RootAlert[];
}

const matchesBoard = (board: Board, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return !needle || board.name.toLowerCase().includes(needle);
};

const commandItem = (command: LauncherCommand): RootItem => ({
  command,
  id: command.id,
  kind: "command",
});

const recentItems = (
  recents: readonly RecentAsk[],
  query: string
): RootItem[] =>
  query.trim()
    ? []
    : recents.slice(0, RECENTS_SHOWN).map((ask) => ({
        ask,
        id: recentItemId(ask.id),
        kind: "recent",
      }));

const alertItems = (alerts: readonly RootAlert[], query: string): RootItem[] =>
  query.trim()
    ? []
    : alerts.map((alert) => ({
        alert,
        id: alertItemId(alert.watchId),
        kind: "alert",
      }));

const lookupSection = (
  origin: LookupOrigin,
  value: LookupValue | null,
  connection: DatabaseConnection | null
): RootSection | null => {
  if (!(value && connection)) {
    return null;
  }
  const item: RootItem = {
    connection,
    id: LOOKUP_ITEM_IDS[origin],
    kind: "lookup",
    origin,
    value,
  };
  return origin === "typed"
    ? { id: "lookup", items: [item], label: "Look up" }
    : { id: "clipboard", items: [item], label: "From clipboard" };
};

const present = (sections: readonly (RootSection | null)[]): RootSection[] =>
  sections.filter((section): section is RootSection => section !== null);

// A bare number is more often a search than an id, so it follows the Ask row.
const leadingSections = (
  ask: RootSection | null,
  typed: RootSection | null,
  lookup: LookupValue | null
): RootSection[] =>
  present(lookup?.kind === "integer" ? [ask, typed] : [typed, ask]);

export const buildRootSections = ({
  query,
  connections,
  commands,
  aiSetup,
  askWith = null,
  widgets = [],
  recents = [],
  boards = [],
  lookup = null,
  offer = null,
  lookupWith = null,
  alerts = [],
}: BuildRootSectionsInput): RootSection[] => {
  const prompt = query.trim();
  const typed = lookupSection("typed", lookup, lookupWith);
  const clipboard = lookupSection(
    "clipboard",
    prompt ? null : offer,
    lookupWith
  );
  const connectionItems: RootItem[] = filterConnections(connections, query).map(
    (connection) => ({ connection, id: connection.id, kind: "connection" })
  );
  const widgetItems: RootItem[] = filterWidgets(widgets, query).map(
    (widget) => ({ id: widgetItemId(widget.id), kind: "widget", widget })
  );
  const boardItems: RootItem[] = boards
    .filter((board) => matchesBoard(board, query))
    .map((board) => ({ board, id: boardItemId(board.id), kind: "board" }));
  const commandItems = filterCommands(commands, query).map(commandItem);
  const sections: RootSection[] = [
    { id: "alerts", items: alertItems(alerts, query), label: "Alerts" },
    { id: "recent", items: recentItems(recents, query), label: "Recent" },
    { id: "widgets", items: widgetItems, label: "Widgets" },
    { id: "boards", items: boardItems, label: "Boards" },
    { id: "connections", items: connectionItems, label: "Connections" },
    { id: "commands", items: commandItems, label: "Commands" },
  ];
  const nothingMatched =
    connectionItems.length +
      commandItems.length +
      widgetItems.length +
      boardItems.length ===
    0;
  if (nothingMatched && aiSetup && prompt) {
    const setup: RootSection = {
      id: "ask",
      items: [commandItem(aiSetup)],
      label: "Ask",
    };
    return leadingSections(setup, typed, lookup);
  }
  const matched = sections.filter((section) => section.items.length > 0);
  const ask: RootSection | null =
    askWith && prompt
      ? {
          id: "ask",
          items: [
            { connection: askWith, id: ASK_ITEM_ID, kind: "ask", prompt },
          ],
          label: "Ask",
        }
      : null;
  return [
    ...leadingSections(ask, typed, lookup),
    ...present([clipboard]),
    ...matched,
  ];
};

export const flattenSections = (sections: readonly RootSection[]): RootItem[] =>
  sections.flatMap((section) => section.items);
