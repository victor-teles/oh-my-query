import type { ComponentType } from "react";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectionEnvironment } from "@/lib/connections";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SQL_PREVIEW_MAX = 400;

interface SafeModeConfirmDialogProps {
  classification: DestructiveClassification | null;
  sql: string | null;
  environment: ConnectionEnvironment | null;
  connectionName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

interface FrozenPayload {
  classification: DestructiveClassification;
  sql: string;
  environment: ConnectionEnvironment | null;
  connectionName: string | null;
}

interface HeaderStyle {
  Icon: ComponentType<{ className?: string }>;
  tone: string;
}

const HEADER_STYLES: Record<"prod" | "staging" | "default", HeaderStyle> = {
  default: { Icon: ShieldAlert, tone: "text-muted-foreground" },
  prod: { Icon: ShieldAlert, tone: "text-destructive" },
  staging: { Icon: AlertTriangle, tone: "text-warning" },
};

const getHeaderStyle = (env: ConnectionEnvironment | null): HeaderStyle => {
  if (env === "prod") {
    return HEADER_STYLES.prod;
  }
  if (env === "staging") {
    return HEADER_STYLES.staging;
  }
  return HEADER_STYLES.default;
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

const buildDescription = (display: FrozenPayload) => {
  if (display.environment === "prod") {
    return (
      <>
        Connection{" "}
        <span className="font-medium text-foreground">
          {display.connectionName}
        </span>{" "}
        is tagged <span className="font-medium text-destructive">prod</span>.{" "}
        {display.classification.reason} Type the connection name exactly to
        confirm.
      </>
    );
  }
  return (
    <>
      {display.classification.reason} Safe mode is on — confirm to run anyway.
    </>
  );
};

interface DialogBodyProps {
  display: FrozenPayload;
  typedConfirmation: string;
  onConfirmInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const DialogBody = ({
  display,
  typedConfirmation,
  onConfirmInput,
  onCancel,
  onConfirm,
}: DialogBodyProps) => {
  const isProd = display.environment === "prod";
  const requiresTyping = isProd && Boolean(display.connectionName);
  const confirmEnabled =
    !requiresTyping || typedConfirmation === display.connectionName;
  const { Icon: HeaderIcon, tone: iconTone } = getHeaderStyle(
    display.environment
  );
  const title = isProd
    ? `Run ${display.classification.keyword} against production?`
    : `Run ${display.classification.keyword} query?`;
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
        <DialogDescription>{buildDescription(display)}</DialogDescription>
      </DialogHeader>
      <pre
        className="
          max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px]
          leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground
        "
      >
        {truncate(display.sql)}
      </pre>
      {requiresTyping && display.connectionName && (
        <ProdConfirmInput
          connectionName={display.connectionName}
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
  classification,
  sql,
  environment,
  connectionName,
  onCancel,
  onConfirm,
}: SafeModeConfirmDialogProps) => {
  const open = classification !== null && sql !== null;
  const frozenRef = useRef<FrozenPayload | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  if (classification && sql) {
    frozenRef.current = { classification, connectionName, environment, sql };
  }

  const display: FrozenPayload | null =
    classification && sql
      ? { classification, connectionName, environment, sql }
      : frozenRef.current;

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
          display={display}
          onCancel={onCancel}
          onConfirm={onConfirm}
          onConfirmInput={handleConfirmInput}
          typedConfirmation={typedConfirmation}
        />
      )}
    </Dialog>
  );
};
