import type { MouseEvent } from "react";

import { memo, useCallback, useMemo, useRef, useState } from "react";

import { Popover } from "@/components/ui/popover";
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
  const anchorRef = useRef<HTMLDivElement>(null);

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

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onActivate(event, rowIndex, columnIndex);
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
      className={`text-data relative flex shrink-0 items-center overflow-hidden bg-background px-2 transition-all duration-150 ease-out group-hover/row:bg-muted/50 group-data-[state=selected]/row:bg-primary/15 data-[last-left-pin]:shadow-[inset_-1px_0_0_0_var(--color-border)] data-[first-right-pin]:shadow-[inset_1px_0_0_0_var(--color-border)] data-[pinned]:z-10 group-data-[scrolled-x]/grid:data-[last-left-pin]:shadow-[4px_0_6px_-2px_rgb(0_0_0/0.25),inset_-1px_0_0_0_var(--color-border)] data-[active-cell]:ring-2 data-[active-cell]:ring-ring/50 data-[active-cell]:ring-inset data-[active-cell]:z-[15] ${rightAlign ? "justify-end" : ""}`}
      data-active-cell={isActive ? "" : undefined}
      onDoubleClick={handleDoubleClick}
      ref={anchorRef}
      role="gridcell"
      style={style}
      {...pin.dataAttrs}
    >
      <div className="w-full truncate">
        {isNull(value) ? (
          <span className="italic text-muted-foreground">NULL</span>
        ) : (
          formatted
        )}
      </div>
      <Popover onOpenChange={setOpen} open={open}>
        {open ? (
          <CellDetailPopover
            anchor={anchorRef}
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
