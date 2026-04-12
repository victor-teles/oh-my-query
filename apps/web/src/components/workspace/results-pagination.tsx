import type { Table } from "@tanstack/react-table";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResultsPaginationProps {
  table: Table<unknown[]>;
}

export const ResultsPagination = ({ table }: ResultsPaginationProps) => {
  const handlePrevious = useCallback(() => table.previousPage(), [table]);
  const handleNext = useCallback(() => table.nextPage(), [table]);

  return (
    <div className="flex items-center justify-between border-t px-3 py-1.5 pb-3 text-xs text-muted-foreground">
      <span>
        Page {table.getState().pagination.pageIndex + 1} of{" "}
        {table.getPageCount()}
      </span>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handlePrevious}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              />
            }
          >
            <ChevronLeft className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleNext}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              />
            }
          >
            <ChevronRight className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
