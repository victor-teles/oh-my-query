import { useVirtualizer } from "@tanstack/react-virtual";
import { HistoryIcon, SearchIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { HistoryEntry, HistoryFilters } from "@/lib/persistence";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useAllQueryHistory } from "@/hooks/use-all-query-history";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { getConnections } from "@/lib/connections";
import { getDateLabel } from "@/lib/history-shared";
import { cn } from "@/lib/utils";

import { HistoryFiltersPanel } from "./history-filters";
import { HistoryPreview } from "./history-preview";
import { HistoryRow } from "./history-row";

const EMPTY_FILTERS: HistoryFilters = {};
const SEARCH_DEBOUNCE_MS = 200;
const ROW_ESTIMATE_PX = 72;
const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5];
const GROUP_HEADER_PX = 28;

interface FlatItem {
  kind: "header" | "row";
  label?: string;
  entry?: HistoryEntry;
}

const flattenWithGroups = (entries: HistoryEntry[]): FlatItem[] => {
  const items: FlatItem[] = [];
  let currentLabel = "";
  for (const entry of entries) {
    const label = getDateLabel(entry.timestamp);
    if (label !== currentLabel) {
      currentLabel = label;
      items.push({ kind: "header", label });
    }
    items.push({ entry, kind: "row" });
  }
  return items;
};

export const QueryHistoryPanel = () => {
  const { open, setOpen } = useHistoryPanel();
  const { openQuery } = useEditorInsert();
  const shouldReduceMotion = useReducedMotion();

  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const list = await getConnections();
      if (!cancelled) {
        setConnections(list);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        query: searchInput.trim() === "" ? undefined : searchInput,
      }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { entries, error, isLoading, refresh } = useAllQueryHistory(filters);

  const connectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of connections) {
      map.set(c.id, c.name);
    }
    return map;
  }, [connections]);

  const rowEntries = entries;

  const items = useMemo<FlatItem[]>(
    () => flattenWithGroups(rowEntries),
    [rowEntries]
  );

  const rowIndexes = useMemo(() => {
    const map: number[] = [];
    for (let i = 0; i < items.length; i += 1) {
      if (items[i]?.kind === "row") {
        map.push(i);
      }
    }
    return map;
  }, [items]);

  const entryIndexMap = useMemo(() => {
    const m = new Map<HistoryEntry, number>();
    for (let i = 0; i < rowEntries.length; i += 1) {
      const e = rowEntries[i];
      if (e) {
        m.set(e, i);
      }
    }
    return m;
  }, [rowEntries]);

  const focusedEntry =
    focusedIndex !== null ? (rowEntries[focusedIndex] ?? null) : null;

  useEffect(() => {
    if (rowEntries.length === 0) {
      setFocusedIndex(null);
      return;
    }
    if (focusedIndex === null) {
      return;
    }
    if (focusedIndex >= rowEntries.length) {
      setFocusedIndex(rowEntries.length - 1);
    }
  }, [rowEntries.length, focusedIndex]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    estimateSize: (index) => {
      const item = items[index];
      return item?.kind === "header" ? GROUP_HEADER_PX : ROW_ESTIMATE_PX;
    },
    getScrollElement: () => scrollRef.current,
    overscan: 10,
  });

  const handleFocusRow = useCallback(
    (entry: HistoryEntry) => {
      const idx = entryIndexMap.get(entry) ?? -1;
      if (idx !== -1) {
        setFocusedIndex(idx);
      }
    },
    [entryIndexMap]
  );

  const handleOpenRow = useCallback(
    (entry: HistoryEntry) => {
      openQuery(entry.sql);
      setOpen(false);
    },
    [openQuery, setOpen]
  );

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(e.target.value);
    },
    []
  );

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        if (searchInput) {
          e.preventDefault();
          setSearchInput("");
          return;
        }
        e.preventDefault();
        setOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const targetingEditable =
        target !== null &&
        target !== searchRef.current &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Enter" && focusedEntry && !targetingEditable) {
        e.preventDefault();
        handleOpenRow(focusedEntry);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (targetingEditable || rowEntries.length === 0) {
          return;
        }
        e.preventDefault();
        setFocusedIndex((prev) => {
          const start = prev ?? -1;
          const next =
            e.key === "ArrowDown"
              ? Math.min(start + 1, rowEntries.length - 1)
              : Math.max(start - 1, 0);
          return next;
        });
      }
    },
    [focusedEntry, handleOpenRow, rowEntries.length, searchInput, setOpen]
  );

  useEffect(() => {
    if (!open) {
      setFocusedIndex(null);
      return;
    }
    const id = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (focusedIndex === null) {
      return;
    }
    const flatIdx = rowIndexes[focusedIndex];
    if (flatIdx === undefined) {
      return;
    }
    rowVirtualizer.scrollToIndex(flatIdx, { align: "auto" });
  }, [focusedIndex, rowIndexes, rowVirtualizer]);

  const resultLabel = useMemo(() => {
    if (isLoading) {
      return "Loading…";
    }
    if (rowEntries.length === 0) {
      return null;
    }
    return `${rowEntries.length.toLocaleString()} ${rowEntries.length === 1 ? "query" : "queries"}`;
  }, [isLoading, rowEntries.length]);

  const reduceMotion = shouldReduceMotion ?? false;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          animate={{ x: 0 }}
          aria-label="Query history"
          className={cn(
            "absolute inset-y-0 right-0 z-40 flex flex-col",
            "w-[min(720px,60vw)] min-w-[480px]",
            "bg-background",
            "border-l border-border"
          )}
          exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          onKeyDown={handlePanelKeyDown}
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { damping: 40, stiffness: 380, type: "spring" }
          }
        >
          <header
            className="
            flex items-center gap-3 border-b border-border px-3 py-2
          "
          >
            <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-sm font-medium">History</span>
              {resultLabel ? (
                <span
                  className="
                    truncate text-[11px] text-muted-foreground/70 tabular-nums
                  "
                >
                  {resultLabel}
                </span>
              ) : null}
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Close history"
                    onClick={handleClose}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <XIcon className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                Close <Kbd className="ml-1">Esc</Kbd>
              </TooltipContent>
            </Tooltip>
          </header>

          <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <SearchIcon />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                onChange={handleSearchChange}
                placeholder="Search SQL"
                ref={searchRef}
                value={searchInput}
              />
            </InputGroup>
            <HistoryFiltersPanel
              connections={connections}
              filters={filters}
              onReset={handleReset}
              setFilters={setFilters}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto" ref={scrollRef}>
              {isLoading && rowEntries.length === 0 && (
                <div className="flex flex-col gap-2 p-3">
                  {SKELETON_ITEMS.map((id) => (
                    <Skeleton className="h-14 w-full" key={id} />
                  ))}
                </div>
              )}

              {error && !isLoading && (
                <div className="flex h-full items-center justify-center p-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>History didn&apos;t load</EmptyTitle>
                      <EmptyDescription>{error}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={refresh} size="sm" variant="outline">
                        Try again
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              )}

              {!error && !isLoading && rowEntries.length === 0 && (
                <div className="flex h-full items-center justify-center p-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HistoryIcon />
                      </EmptyMedia>
                      <EmptyTitle>No matching queries</EmptyTitle>
                      <EmptyDescription>
                        Clear filters, or run a query to see it here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              )}

              {rowEntries.length > 0 && (
                <div
                  aria-activedescendant={
                    focusedEntry ? `history-row-${focusedIndex}` : undefined
                  }
                  className="relative"
                  role="listbox"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                  tabIndex={-1}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = items[virtualRow.index];
                    if (!item) {
                      return null;
                    }
                    if (item.kind === "header") {
                      return (
                        <div
                          className="
                            absolute inset-x-0 flex items-end px-4 pb-1
                            text-[10px] font-medium tracking-[0.022em]
                            text-muted-foreground/70 uppercase
                          "
                          data-index={virtualRow.index}
                          key={virtualRow.key}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {item.label}
                        </div>
                      );
                    }
                    const { entry } = item;
                    if (!entry) {
                      return null;
                    }
                    const entryRowIndex = entryIndexMap.get(entry) ?? -1;
                    const isFocused = focusedIndex === entryRowIndex;
                    return (
                      <div
                        className="absolute inset-x-0 px-2"
                        data-index={virtualRow.index}
                        id={`history-row-${entryRowIndex}`}
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <HistoryRow
                          connectionName={
                            connectionNameById.get(entry.connectionId) ?? null
                          }
                          entry={entry}
                          focused={isFocused}
                          onFocus={handleFocusRow}
                          onOpen={handleOpenRow}
                          selected={isFocused}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <HistoryPreview
              connectionName={
                focusedEntry
                  ? (connectionNameById.get(focusedEntry.connectionId) ?? null)
                  : null
              }
              entry={focusedEntry}
              onOpen={handleOpenRow}
              reduceMotion={reduceMotion}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
