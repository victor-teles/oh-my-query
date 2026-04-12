import { useEffect } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { useIsland } from "@/contexts/island-context";

interface HomeIslandSyncInput {
  welcomeActive: boolean;
  launchingConnection: DatabaseConnection | null;
  selectedConnection: DatabaseConnection | null;
}

export const useHomeIslandSync = ({
  welcomeActive,
  launchingConnection,
  selectedConnection,
}: HomeIslandSyncInput) => {
  const { setSnapshot } = useIsland();

  useEffect(() => {
    if (welcomeActive) {
      setSnapshot({ kind: "welcome" });
      return;
    }
    if (launchingConnection) {
      setSnapshot({
        connectionName: launchingConnection.name,
        kind: "connecting",
      });
      return;
    }
    if (selectedConnection) {
      setSnapshot({
        connectionName: selectedConnection.name,
        kind: "ambient",
      });
      return;
    }
    setSnapshot({ kind: "hidden" });
  }, [welcomeActive, launchingConnection, selectedConnection, setSnapshot]);
};
