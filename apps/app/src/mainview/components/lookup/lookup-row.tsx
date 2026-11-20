import { ClipboardIcon, SearchIcon } from "lucide-react";

import type { LookupOrigin } from "@/components/launcher/views/root-items";
import type { DatabaseConnection } from "@/lib/connections";
import type { LookupValue } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";

import { KIND_TAGS, shortValue } from "./lookup-labels";

interface LookupOffer {
  id: string;
  value: LookupValue;
  connection: DatabaseConnection;
}

interface LookupRowProps {
  offer: LookupOffer;
  variant: LookupOrigin;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

const Glyph = { clipboard: ClipboardIcon, typed: SearchIcon };

export function LookupRow({
  offer,
  variant,
  selected,
  onHover,
  onRun,
}: LookupRowProps) {
  const { id, value, connection } = offer;
  const Icon = Glyph[variant];
  const where =
    variant === "clipboard" ? "from your clipboard" : `in ${connection.name}`;
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      <span className="relative grid size-6 shrink-0 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-1.5 truncate type-body">
        <span className="shrink-0 text-panel-muted">Find</span>
        <span className="truncate font-mono text-[12px] text-foreground">
          {shortValue(value)}
        </span>
        <span className="shrink-0 text-panel-muted">{where}</span>
      </span>
      <span className="relative shrink-0 type-micro text-panel-muted">
        {KIND_TAGS[value.kind]}
      </span>
    </LauncherRow>
  );
}
