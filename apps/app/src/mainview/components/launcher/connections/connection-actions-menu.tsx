import type { DatabaseConnection } from "@/lib/connections";

import { ActionsMenu } from "@/components/launcher/actions/actions-menu";
import { optionId } from "@/components/launcher/launcher-row";

import type { ConnectionAction } from "./connection-actions";

interface ConnectionActionsMenuProps {
  connection: DatabaseConnection;
  actions: readonly ConnectionAction[];
  armed: boolean;
  onRun: (action: ConnectionAction) => void;
  onClose: () => void;
}

export function ConnectionActionsMenu({
  connection,
  actions,
  armed,
  onRun,
  onClose,
}: ConnectionActionsMenuProps) {
  return (
    <ActionsMenu
      actions={actions}
      anchorId={optionId(connection.id)}
      armedId={armed ? "delete" : null}
      onClose={onClose}
      onRun={onRun}
      title={connection.name}
    />
  );
}
