import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { RedisKey } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteKeyDialogProps {
  redisKey: RedisKey | null;
  dbIndex: number;
  onConfirm: (name: string) => Promise<void>;
  onClose: () => void;
}

export const DeleteKeyDialog = ({
  redisKey,
  dbIndex,
  onConfirm,
  onClose,
}: DeleteKeyDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!redisKey) {
      return;
    }
    setIsDeleting(true);
    try {
      await onConfirm(redisKey.name);
      toast.success(`Deleted \`${redisKey.name}\``);
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Delete failed";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }, [redisKey, onConfirm, onClose]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDeleting) {
        onClose();
      }
    },
    [isDeleting, onClose]
  );

  return (
    <Dialog open={redisKey !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete key?</DialogTitle>
          <DialogDescription>
            Permanently remove{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              {redisKey?.name}
            </code>{" "}
            from db{dbIndex}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isDeleting} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isDeleting}
            onClick={handleConfirm}
            variant="destructive"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
