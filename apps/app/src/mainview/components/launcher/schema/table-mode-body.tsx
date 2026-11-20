import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { TableDetailPane, TableList } from "./table-panes";
import type { TableCatalog } from "./use-table-catalog";

import {
  TableDetailSkeleton,
  TableListSkeleton,
} from "./table-detail-skeleton";
import { TableError, TableMessage } from "./table-message";
import { TablePanes } from "./table-panes";

export const TABLE_BODY_HEIGHT = 320;

interface TableModeBodyProps {
  catalog: TableCatalog;
  needle: string;
  onRetry: () => void;
  list: TableList;
  detail: TableDetailPane;
}

function TableState({
  catalog,
  needle,
  onRetry,
  list,
  detail,
}: TableModeBodyProps) {
  const skeletonShown = useDelayedVisibility(catalog.status === "loading");
  if (catalog.status === "error") {
    return <TableError message={catalog.message} onRetry={onRetry} />;
  }
  if (catalog.status !== "ready") {
    return skeletonShown ? (
      <div
        aria-label="Loading tables"
        className="grid h-full grid-cols-[2fr_3fr]"
        role="status"
      >
        <TableListSkeleton />
        <TableDetailSkeleton />
      </div>
    ) : null;
  }
  if (list.items.length > 0) {
    return <TablePanes detail={detail} list={list} />;
  }
  return needle ? (
    <TableMessage
      detail="Try part of the name, or schema.table."
      title={`No table matches “${needle}”.`}
    />
  ) : (
    <TableMessage title={`No tables in ${catalog.peek.database}.`} />
  );
}

export function TableModeBody(props: TableModeBodyProps) {
  return (
    <div className="min-h-0" style={{ height: TABLE_BODY_HEIGHT }}>
      <TableState {...props} />
    </div>
  );
}
