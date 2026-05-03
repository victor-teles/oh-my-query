import { XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (redisKey === null) {
      setDeleteError(null);
    }
  }, [redisKey]);

  const handleConfirm = useCallback(async () => {
    if (!redisKey) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm(redisKey.name);
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
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
            <code className="rounded-sm bg-muted px-1 font-mono text-xs">
              {redisKey?.name}
            </code>{" "}
            from db{dbIndex}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {deleteError && (
          <p
            aria-live="polite"
            className="
              flex items-start gap-1.5 rounded-md border border-destructive/30
              bg-destructive/5 px-3 py-2 text-xs text-destructive
            "
            role="alert"
          >
            <XCircle className="mt-0.5 size-3.5 shrink-0" />
            <span className="wrap-break-word">{deleteError}</span>
          </p>
        )}
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
