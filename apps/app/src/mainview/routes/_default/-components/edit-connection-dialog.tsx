import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionForm } from "@/components/connection-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EditConnectionDialog = ({
  connection,
  open,
  onOpenChange,
  onSuccess,
}: {
  connection: DatabaseConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (connection: DatabaseConnection) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit connection</DialogTitle>
        <DialogDescription>Update your connection settings.</DialogDescription>
      </DialogHeader>
      {connection && (
        <ConnectionForm connection={connection} onSuccess={onSuccess} />
      )}
    </DialogContent>
  </Dialog>
);

export { EditConnectionDialog };
