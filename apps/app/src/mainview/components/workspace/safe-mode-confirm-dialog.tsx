import type { ComponentType } from "react";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SafeModeConfirmationRequest } from "@/contexts/safe-mode-context";
import type { ConnectionEnvironment } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SQL_PREVIEW_MAX = 400;

interface SafeModeConfirmDialogProps {
  request: SafeModeConfirmationRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}

interface HeaderStyle {
  Icon: ComponentType<{ className?: string }>;
  tone: string;
}

const getHeaderStyle = (env: ConnectionEnvironment | null): HeaderStyle => {
  if (env === "prod") {
    return { Icon: ShieldAlert, tone: "text-destructive" };
  }
  if (env === "staging") {
    return { Icon: AlertTriangle, tone: "text-warning" };
  }
  return { Icon: ShieldAlert, tone: "text-muted-foreground" };
};

const truncate = (text: string): string =>
  text.length > SQL_PREVIEW_MAX ? `${text.slice(0, SQL_PREVIEW_MAX)}…` : text;

interface ProdConfirmInputProps {
  connectionName: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProdConfirmInput = ({
  connectionName,
  value,
  onChange,
}: ProdConfirmInputProps) => (
  <div className="grid gap-1.5">
    <Label htmlFor="prod-confirm">
      Type{" "}
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px]">
        {connectionName}
      </code>{" "}
      to confirm
    </Label>
    <Input
      autoComplete="off"
      // biome-ignore lint/a11y/noAutofocus: confirmation input should receive focus when dialog opens
      autoFocus
      id="prod-confirm"
      onChange={onChange}
      placeholder={connectionName}
      value={value}
    />
  </div>
);

const buildDescription = (request: SafeModeConfirmationRequest) => {
  if (request.environment === "prod") {
    return (
      <>
        Connection{" "}
        <span className="font-medium text-foreground">
          {request.connectionName}
        </span>{" "}
        is tagged <span className="font-medium text-destructive">prod</span>.{" "}
        {request.classification.reason} Type the connection name exactly to
        confirm.
      </>
    );
  }
  return (
    <>
      {request.classification.reason} Safe mode is on — confirm to run anyway.
    </>
  );
};

interface DialogBodyProps {
  request: SafeModeConfirmationRequest;
  typedConfirmation: string;
  onConfirmInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const DialogBody = ({
  request,
  typedConfirmation,
  onConfirmInput,
  onCancel,
  onConfirm,
}: DialogBodyProps) => {
  const isProd = request.environment === "prod";
  const requiresTyping = isProd && Boolean(request.connectionName);
  const confirmEnabled =
    !requiresTyping || typedConfirmation === request.connectionName;
  const { Icon: HeaderIcon, tone: iconTone } = getHeaderStyle(
    request.environment
  );
  const title = isProd
    ? `Run ${request.classification.keyword} against production?`
    : `Run ${request.classification.keyword} query?`;
  const confirmLabel = isProd
    ? "I understand — run against prod"
    : "Run anyway";

  return (
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-1.5">
          <HeaderIcon className={`
              size-3.5
              ${iconTone}
            `} />
          {title}
        </DialogTitle>
        <DialogDescription>{buildDescription(request)}</DialogDescription>
      </DialogHeader>
      <pre
        className="
          max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px]
          leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground
        "
      >
        {truncate(request.query)}
      </pre>
      {requiresTyping && request.connectionName && (
        <ProdConfirmInput
          connectionName={request.connectionName}
          onChange={onConfirmInput}
          value={typedConfirmation}
        />
      )}
      <DialogFooter>
        <Button
          autoFocus={!requiresTyping}
          onClick={onCancel}
          size="sm"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          disabled={!confirmEnabled}
          onClick={onConfirm}
          size="sm"
          variant="destructive"
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export const SafeModeConfirmDialog = ({
  request,
  onCancel,
  onConfirm,
}: SafeModeConfirmDialogProps) => {
  const open = request !== null;
  const frozenRef = useRef<SafeModeConfirmationRequest | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  if (request) {
    frozenRef.current = request;
  }

  const display = request ?? frozenRef.current;

  useEffect(() => {
    if (!open) {
      setTypedConfirmation("");
    }
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onCancel();
      }
    },
    [onCancel]
  );

  const handleConfirmInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTypedConfirmation(e.target.value);
    },
    []
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {display && (
        <DialogBody
          onCancel={onCancel}
          onConfirm={onConfirm}
          onConfirmInput={handleConfirmInput}
          request={display}
          typedConfirmation={typedConfirmation}
        />
      )}
    </Dialog>
  );
};
