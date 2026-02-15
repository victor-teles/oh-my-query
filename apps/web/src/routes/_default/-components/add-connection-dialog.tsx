import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionForm } from "@/components/connection-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AddConnectionDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (connection: DatabaseConnection) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a connection</DialogTitle>
        <DialogDescription>
          Connect to a database to start querying.
        </DialogDescription>
      </DialogHeader>
      <ConnectionForm onSuccess={onSuccess} />
    </DialogContent>
  </Dialog>
);

export { AddConnectionDialog };
