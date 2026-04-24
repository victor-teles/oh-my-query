import { formatDistanceToNow } from "date-fns";
import { ArrowUpRightIcon, DatabaseIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { HistoryEntry } from "@/lib/persistence";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { isKnownDialect } from "@/lib/history-shared";
import { cn } from "@/lib/utils";

interface HistoryPreviewProps {
  entry: HistoryEntry | null;
  connectionName: string | null;
  reduceMotion: boolean;
  onOpen: (entry: HistoryEntry) => void;
}

export const HistoryPreview = ({
  entry,
  connectionName,
  reduceMotion,
  onOpen,
}: HistoryPreviewProps) => {
  const handleOpen = useCallback(() => {
    if (entry) {
      onOpen(entry);
    }
  }, [entry, onOpen]);

  const DialectIcon =
    entry && isKnownDialect(entry.dialect)
      ? DATABASE_ICON_MAP[entry.dialect]
      : null;

  const connectionLabel = entry ? (connectionName ?? "Deleted connection") : "";

  return (
    <AnimatePresence initial={false}>
      {entry ? (
        <motion.section
          animate={{ height: "auto", opacity: 1 }}
          aria-label="Query preview"
          className="overflow-hidden border-t border-border bg-muted/20"
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          key={entry.timestamp + entry.connectionId}
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { damping: 36, stiffness: 360, type: "spring" }
          }
        >
          <div className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                {DialectIcon ? (
                  <DialectIcon className="size-3 shrink-0 text-muted-foreground/80" />
                ) : (
                  <DatabaseIcon className="size-3 shrink-0 text-muted-foreground/80" />
                )}
                <span
                  className={cn(
                    "truncate",
                    !connectionName && "text-muted-foreground/60"
                  )}
                >
                  {connectionLabel}
                </span>
                {entry.database ? (
                  <span className="shrink-0 text-muted-foreground/60">
                    · {entry.database}
                  </span>
                ) : null}
                <span className="shrink-0 tabular-nums">
                  · {entry.executionTimeMs}ms
                </span>
                <span className="shrink-0">
                  ·{" "}
                  {formatDistanceToNow(new Date(entry.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <Button
                className="h-6 text-[11px]"
                onClick={handleOpen}
                size="sm"
                variant="ghost"
              >
                Open
                <ArrowUpRightIcon className="size-3" />
                <KbdGroup className="ml-1">
                  <Kbd>↵</Kbd>
                </KbdGroup>
              </Button>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-2 font-mono text-[12px] leading-relaxed text-foreground">
              {entry.sql}
            </pre>
            {!entry.success && entry.error ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
                {entry.error}
              </p>
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
