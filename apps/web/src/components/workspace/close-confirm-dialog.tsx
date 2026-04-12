import { TriangleAlert } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CloseConfirmDialogProps {
  open: boolean;
  dirtyCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export const CloseConfirmDialog = ({
  open,
  dirtyCount,
  onCancel,
  onConfirm,
}: CloseConfirmDialogProps) => {
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 text-muted-foreground" />
            Unsaved changes
          </DialogTitle>
          <DialogDescription>
            You have {dirtyCount} tab{dirtyCount !== 1 ? "s" : ""} with
            unexecuted changes. Closing will discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button autoFocus onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm} size="sm" variant="destructive">
            Close anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
