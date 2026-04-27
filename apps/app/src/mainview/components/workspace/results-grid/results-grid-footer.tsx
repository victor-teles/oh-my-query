import { ArrowDownToLine } from "lucide-react";
import { useCallback } from "react";

import type { TabularResult } from "@/lib/tauri";

interface ResultsGridFooterProps {
  result: TabularResult;
  selectedCount: number;
  onLoadMore?: (nextMaxRows: number) => void;
}

const formatCount = (n: number): string => n.toLocaleString("en-US");

interface ShortcutProps {
  keys: string;
  label: string;
}

const Shortcut = ({ keys, label }: ShortcutProps) => (
  <span className="inline-flex items-center gap-1">
    <kbd className="font-mono text-[11px] text-foreground/70">{keys}</kbd>
    <span>{label}</span>
  </span>
);

interface LoadMoreButtonProps {
  rowCount: number;
  onLoadMore: (nextMaxRows: number) => void;
}

const LoadMoreButton = ({ rowCount, onLoadMore }: LoadMoreButtonProps) => {
  const handleClick = useCallback(() => {
    onLoadMore(rowCount * 2);
  }, [rowCount, onLoadMore]);

  return (
    <button
      className="ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:bg-accent/60 focus-visible:outline-none"
      onClick={handleClick}
      type="button"
    >
      <ArrowDownToLine className="size-3" />
      Load {formatCount(rowCount)} more
    </button>
  );
};

export const ResultsGridFooter = ({
  result,
  selectedCount,
  onLoadMore,
}: ResultsGridFooterProps) => {
  const { rowCount, isTruncated } = result;
  return (
    <div className="flex items-center justify-between gap-4 border-border/40 border-t px-3 py-1.5 text-muted-foreground text-xs">
      <span className="inline-flex items-center">
        <span className="font-mono tabular-nums text-foreground">
          {formatCount(rowCount)}
        </span>
        <span className="ml-1">{rowCount === 1 ? "row" : "rows"}</span>
        {isTruncated && (
          <>
            <span className="ml-2 text-muted-foreground/70">(truncated)</span>
            {onLoadMore && (
              <LoadMoreButton onLoadMore={onLoadMore} rowCount={rowCount} />
            )}
          </>
        )}
      </span>
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex items-center gap-3 text-muted-foreground/70 opacity-0 transition-opacity group-focus-within/results:opacity-100"
        >
          <Shortcut keys="⌘C" label="Copy" />
          <Shortcut keys="⌘A" label="All" />
          <Shortcut keys="↵" label="Detail" />
        </span>
        {selectedCount > 0 && (
          <span>
            <span className="font-mono tabular-nums text-foreground">
              {formatCount(selectedCount)}
            </span>{" "}
            selected
          </span>
        )}
      </div>
    </div>
  );
};
