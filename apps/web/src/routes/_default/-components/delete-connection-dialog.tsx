import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DeleteConnectionDialog = ({
  connection,
  open,
  onOpenChange,
  onConfirm,
}: {
  connection: DatabaseConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Delete connection</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete{" "}
          <strong className="text-foreground">{connection?.name}</strong>? This
          action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogPrimitive.Close render={<Button variant="outline" size="sm" />}>
          Cancel
        </DialogPrimitive.Close>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export { DeleteConnectionDialog };
