import type { LucideIcon } from "lucide-react";

import { ClipboardPasteIcon, FileJsonIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import type { ImportSource } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

interface SourceOption {
  source: ImportSource;
  title: string;
  detail: string;
  icon: LucideIcon;
}

export const IMPORT_SOURCES: readonly SourceOption[] = [
  {
    detail: "An export someone sent you",
    icon: ClipboardPasteIcon,
    source: "clipboard",
    title: "From Clipboard",
  },
  {
    detail: "A .omq.json file",
    icon: FileJsonIcon,
    source: "file",
    title: "From File…",
  },
];

interface SourceRowProps {
  option: SourceOption;
  autoFocus: boolean;
  busy: boolean;
  onRead: (source: ImportSource) => void;
}

function SourceRow({ option, autoFocus, busy, onRead }: SourceRowProps) {
  const { source, title, detail, icon: Icon } = option;
  const handleClick = useCallback(() => onRead(source), [onRead, source]);
  return (
    <Pressable
      aria-busy={busy}
      autoFocus={autoFocus}
      className="flex h-10 w-full cursor-default items-center gap-3 rounded-[10px] px-2.5 text-left outline-none hover:bg-row-hover focus-visible:bg-row-active focus-visible:ring-2 focus-visible:ring-ring/60"
      data-import-row
      data-row-focus
      onClick={handleClick}
    >
      <span className="grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">{title}</span>
        <span className="truncate type-meta text-panel-muted">{detail}</span>
      </span>
      <span className="relative h-0.5 w-8 shrink-0 overflow-hidden rounded-full">
        <AnimatePresence>{busy ? <ProgressHairline /> : null}</AnimatePresence>
      </span>
    </Pressable>
  );
}

interface ImportSourcesProps {
  reading: ImportSource | null;
  onRead: (source: ImportSource) => void;
}

export function ImportSources({ reading, onRead }: ImportSourcesProps) {
  const showBusy = useDelayedVisibility(reading !== null);
  return (
    <div
      aria-label="Import from"
      className="flex flex-col gap-1 p-2"
      role="group"
    >
      {IMPORT_SOURCES.map((option, index) => (
        <SourceRow
          autoFocus={index === 0}
          busy={showBusy && reading === option.source}
          key={option.source}
          onRead={onRead}
          option={option}
        />
      ))}
    </div>
  );
}
