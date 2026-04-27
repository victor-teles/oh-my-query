import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface KeysStatusFooterProps {
  shown: number;
  total: number | null;
  nextCursor: string;
  isLoading: boolean;
  onLoadMore: () => void;
}

export const KeysStatusFooter = ({
  shown,
  total,
  nextCursor,
  isLoading,
  onLoadMore,
}: KeysStatusFooterProps) => {
  const hasMore = nextCursor !== "0";
  const totalLabel = total === null ? "—" : total.toLocaleString();

  return (
    <div className="flex h-8 items-center justify-between border-t border-sidebar-border px-2.5 text-[11px] text-muted-foreground">
      <span className="font-mono tabular-nums">
        {isLoading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            Scanning… {shown.toLocaleString()} so far
          </span>
        ) : (
          <>
            Showing {shown.toLocaleString()}
            {total !== null && ` of ${totalLabel}`}
          </>
        )}
      </span>
      {hasMore && !isLoading && (
        <Button
          className="h-5 px-1.5 text-[11px]"
          onClick={onLoadMore}
          size="sm"
          variant="ghost"
        >
          Load more
        </Button>
      )}
    </div>
  );
};
