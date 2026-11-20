import { useMemo } from "react";

import type { Board, LookupValue } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { parseLauncherInput } from "@/components/launcher/input-mode";
import {
  aiSetupCommand,
  rootCommands,
} from "@/components/launcher/root-commands";
import {
  catalogTables,
  searchTables,
} from "@/components/launcher/schema/table-search";
import { useTableCatalog } from "@/components/launcher/schema/use-table-catalog";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { isSqlDatabase } from "@/lib/connections";

import type { ModeView } from "./mode-items";
import type { RootNavigation } from "./root-view";
import type { PreviewTarget } from "./use-root-run";

import { modeView } from "./mode-items";
import { buildRootSections, flattenSections } from "./root-items";
import { useAiReadiness } from "./use-ai-readiness";

type CommandNavigation = Pick<
  RootNavigation,
  "openSettings" | "openHistory" | "dismiss" | "editConnection" | "newBoard"
>;

interface UseRootSectionsOptions {
  query: string;
  boards: readonly Board[];
  navigate: CommandNavigation;
  offer: LookupValue | null;
}

export const useRootSections = ({
  query,
  boards,
  navigate,
  offer,
}: UseRootSectionsOptions) => {
  const { state, activeConnection } = useConnections();
  const aiReady = useAiReadiness();
  const { widgets, recents } = useWidgets();
  const { openSettings, openHistory, dismiss, editConnection, newBoard } =
    navigate;

  const commands = useMemo(
    () =>
      rootCommands({
        addConnection: () => editConnection(null),
        dismiss,
        newBoard,
        openHistory,
        openSettings,
      }),
    [dismiss, editConnection, newBoard, openHistory, openSettings]
  );

  const input = useMemo(() => parseLauncherInput(query), [query]);
  const sqlConnection =
    activeConnection && isSqlDatabase(activeConnection.type)
      ? activeConnection
      : null;
  const tableConnection = input.mode === "table" ? sqlConnection : null;
  const { catalog, retry } = useTableCatalog(tableConnection);
  const peek = catalog.status === "ready" ? catalog.peek : null;
  const tables = useMemo(
    () =>
      peek && input.mode === "table"
        ? searchTables(catalogTables(peek.schema), input.needle)
        : [],
    [input, peek]
  );

  const view: ModeView =
    input.mode === "search"
      ? {
          note: null,
          sections: buildRootSections({
            aiSetup: aiReady === false ? aiSetupCommand(openSettings) : null,
            askWith: aiReady === true ? activeConnection : null,
            boards,
            commands,
            connections: state.connections,
            lookup: input.lookup,
            lookupWith: sqlConnection,
            offer,
            query,
            recents,
            widgets,
          }),
        }
      : modeView({
          active: activeConnection,
          connections: state.connections,
          input,
          tables,
        });

  const preview: PreviewTarget | null =
    tableConnection && peek
      ? { connectionId: tableConnection.id, dialect: peek.dialect }
      : null;

  return {
    ...view,
    input,
    items: flattenSections(view.sections),
    query,
    tables: tableConnection ? { catalog, preview, retry } : null,
  };
};

export type RootSectionsView = ReturnType<typeof useRootSections>;
