import { ShieldCheck } from "lucide-react";
import { useCallback, useRef } from "react";

import type { DestructiveClassification } from "@/lib/safe-mode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SQL_PREVIEW_MAX = 400;

interface SafeModeConfirmDialogProps {
  classification: DestructiveClassification | null;
  sql: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

interface FrozenPayload {
  classification: DestructiveClassification;
  sql: string;
}

const truncate = (text: string): string =>
  text.length > SQL_PREVIEW_MAX ? `${text.slice(0, SQL_PREVIEW_MAX)}…` : text;

export const SafeModeConfirmDialog = ({
  classification,
  sql,
  onCancel,
  onConfirm,
}: SafeModeConfirmDialogProps) => {
  const open = classification !== null && sql !== null;
  const frozenRef = useRef<FrozenPayload | null>(null);

  if (classification && sql) {
    frozenRef.current = { classification, sql };
  }

  const display: FrozenPayload | null =
    classification && sql ? { classification, sql } : frozenRef.current;

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
            <ShieldCheck className="size-3.5 text-muted-foreground" />
            Run {display?.classification.keyword} query?
          </DialogTitle>
          <DialogDescription>
            {display?.classification.reason} Safe mode is on — confirm to run
            anyway.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
          {display ? truncate(display.sql) : ""}
        </pre>
        <DialogFooter>
          <Button autoFocus onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm} size="sm" variant="destructive">
            Run anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
