import type { MouseEvent } from "react";

import { memo, useCallback, useMemo, useState } from "react";

import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { formatCell, isNull, isNumber } from "@/lib/format-cell";

import { buildPinStyle } from "./-hooks/use-column-pin-style";
import { CellDetailPopover } from "./cell-detail-popover";

const LARGE_VALUE_THRESHOLD = 5000;

interface ResultsGridCellProps {
  value: unknown;
  columnName: string;
  columnType: string;
  columnIndex: number;
  rowIndex: number;
  width: number;
  pinned: "left" | "right" | false;
  pinOffset: number;
  isLastLeftPin: boolean;
  isFirstRightPin: boolean;
  isActive: boolean;
  onActivate: (
    event: MouseEvent,
    rowIndex: number,
    columnIndex: number
  ) => void;
  onExpand: (cell: { column: string; value: string }) => void;
}

const ResultsGridCellBase = ({
  value,
  columnName,
  columnType,
  columnIndex,
  rowIndex,
  width,
  pinned,
  pinOffset,
  isLastLeftPin,
  isFirstRightPin,
  isActive,
  onActivate,
  onExpand,
}: ResultsGridCellProps) => {
  const [open, setOpen] = useState(false);

  const formatted = useMemo(
    () => (isNull(value) ? "NULL" : formatCell(value)),
    [value]
  );
  const rightAlign = useMemo(() => !isNull(value) && isNumber(value), [value]);

  const pin = useMemo(
    () =>
      buildPinStyle({
        isFirstRight: isFirstRightPin,
        isLastLeft: isLastLeftPin,
        offset: pinOffset,
        pinned,
      }),
    [pinned, pinOffset, isLastLeftPin, isFirstRightPin]
  );

  const style = useMemo(() => ({ ...pin.style, width }), [pin.style, width]);

  const handleCellClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onActivate(event, rowIndex, columnIndex);
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }
      if (!isNull(value) && formatted.length > LARGE_VALUE_THRESHOLD) {
        onExpand({ column: columnName, value: formatted });
        return;
      }
      setOpen(true);
    },
    [value, columnName, columnIndex, rowIndex, onActivate, onExpand, formatted]
  );

  const handleOpenFullDetail = useCallback(() => {
    setOpen(false);
    onExpand({ column: columnName, value: formatted });
  }, [columnName, formatted, onExpand]);

  return (
    <div
      aria-colindex={columnIndex + 1}
      className={`text-data relative flex shrink-0 items-center overflow-hidden bg-background px-2 data-[last-left-pin]:shadow-[inset_-1px_0_0_0_var(--color-border)] data-[first-right-pin]:shadow-[inset_1px_0_0_0_var(--color-border)] data-[pinned]:z-10 group-data-[scrolled-x]/grid:data-[last-left-pin]:shadow-[4px_0_6px_-2px_rgb(0_0_0/0.25),inset_-1px_0_0_0_var(--color-border)] data-[active-cell]:shadow-[inset_0_0_0_1px_var(--color-ring)] data-[active-cell]:z-[15] ${rightAlign ? "justify-end" : ""}`}
      data-active-cell={isActive ? "" : undefined}
      role="gridcell"
      style={style}
      {...pin.dataAttrs}
    >
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          aria-label={`View ${columnName} value`}
          className="block w-full truncate rounded text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
          onClick={handleCellClick}
          type="button"
        >
          {isNull(value) ? (
            <span className="italic text-muted-foreground">NULL</span>
          ) : (
            formatted
          )}
        </PopoverTrigger>
        {open ? (
          <CellDetailPopover
            columnName={columnName}
            columnType={columnType}
            onOpenFullDetail={handleOpenFullDetail}
            value={value}
          />
        ) : null}
      </Popover>
    </div>
  );
};

export const ResultsGridCell = memo(ResultsGridCellBase);
