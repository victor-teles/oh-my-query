import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";

import type { ConnectionAction } from "./connection-actions";

import { useConnections } from "./connections-provider";

interface UseConnectionActionsMenuOptions {
  onEdit: (connectionId: string) => void;
  onClosed: () => void;
}

export const useConnectionActionsMenu = ({
  onEdit,
  onClosed,
}: UseConnectionActionsMenuOptions) => {
  const operations = useConnections();
  const [openId, setOpenId] = useState<string | null>(null);
  const { arm, armed, disarm } = useArmedConfirm();

  const close = useCallback(() => {
    disarm();
    setOpenId(null);
    onClosed();
  }, [disarm, onClosed]);

  const open = useCallback(
    (connectionId: string) => {
      disarm();
      setOpenId(connectionId);
    },
    [disarm]
  );

  const run = useCallback(
    (action: ConnectionAction, connection: DatabaseConnection) => {
      if (action.id === "delete" && !armed) {
        arm();
        return;
      }
      close();
      switch (action.id) {
        case "edit": {
          onEdit(connection.id);
          break;
        }
        case "test": {
          operations.test(connection);
          break;
        }
        case "pin": {
          operations.togglePin(connection);
          break;
        }
        case "disconnect": {
          operations.disconnect(connection);
          break;
        }
        case "delete": {
          operations.remove(connection);
          break;
        }
        default: {
          break;
        }
      }
    },
    [arm, armed, close, onEdit, operations]
  );

  return { armed, close, open, openId, run };
};
