import type { ReactNode } from "react";

import { render } from "vitest-browser-react";

import type { DatabaseConnection } from "@/lib/connections";

import { AppProviders } from "@/components/app-providers";
import { ConnectionsProvider } from "@/components/launcher/connections/connections-provider";
import { WatchesProvider } from "@/components/watches/watches-provider";
import { WidgetsProvider } from "@/components/widgets/widgets-provider";

import type { CommandHandlers } from "./ipc-mock";

import { mockIpc } from "./ipc-mock";

interface LauncherIpcOptions {
  connections?: DatabaseConnection[];
  handlers?: CommandHandlers;
}

// Backs the launcher with an in-memory connection store so writes made by
// one call are visible to the next, like the encrypted file on disk.
export const mockLauncherIpc = ({
  connections = [],
  handlers = {},
}: LauncherIpcOptions = {}) => {
  const store = { active: null as unknown, connections: [...connections] };
  mockIpc({
    connectToDatabase: () => null,
    describeSql: () => null,
    disconnectFromDatabase: () => null,
    getActiveConnection: () => store.active,
    getAiSettings: () => null,
    getAppVersion: () => "1.4.0",
    getClipboardLookups: () => ({ enabled: false }),
    getConnections: () => store.connections,
    getLauncherHotkey: () => "Option+Shift+Space",
    getUpdateChannel: () => "stable",
    getWatchingPaused: () => false,
    hideLauncher: () => null,
    listBoards: () => [],
    listRecentAsks: () => [],
    listWatchStatuses: () => [],
    listWatches: () => [],
    listWidgetTrends: () => ({}),
    listWidgets: () => [],
    resizeLauncher: () => null,
    saveConnections: (payload) => {
      store.connections = payload.connections as DatabaseConnection[];
      return null;
    },
    setActiveConnection: (payload) => {
      store.active = payload.active;
      return null;
    },
    testConnection: () => ({ latencyMs: 12, message: "ok", success: true }),
    ...handlers,
  });
  return store;
};

export const renderWithConnections = (ui: ReactNode) =>
  render(
    <AppProviders>
      <ConnectionsProvider>
        <WidgetsProvider>
          <WatchesProvider>{ui}</WatchesProvider>
        </WidgetsProvider>
      </ConnectionsProvider>
    </AppProviders>
  );
