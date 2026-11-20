import type { ReactNode } from "react";

import { motion } from "motion/react";

import { staggerDelay, useMotionPreset } from "@/lib/motion";

import type { ReviewData } from "./import-reducer";
import type { ImportEdits } from "./use-import";

import { ConnectionMappingRow } from "./connection-mapping-row";
import { ImportBoardsRow } from "./import-boards-row";
import {
  importedTileCount,
  isDuplicateHere,
  widgetChoice,
} from "./import-reducer";
import { ImportWidgetRow } from "./import-widget-row";

interface StaggerItemProps {
  index: number;
  children: ReactNode;
}

function StaggerItem({ index, children }: StaggerItemProps) {
  const { reduced, soft, fadeIn } = useMotionPreset();
  const delay = staggerDelay(index);
  const transition = reduced
    ? { duration: 0 }
    : {
        layout: soft,
        opacity: { ...fadeIn, delay },
        y: { ...soft, delay },
      };
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      layout="position"
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-2 pb-1 type-micro text-panel-muted">
      {children}
    </div>
  );
}

interface ImportReviewProps {
  review: ReviewData;
  edits: ImportEdits;
}

export function ImportReview({ review, edits }: ImportReviewProps) {
  const { bundle, plan, connectionMap } = review;
  const {
    map: handleMap,
    toggleBoards: handleToggleBoards,
    toggleSql: handleToggleSql,
    toggleWidget: handleToggleWidget,
  } = edits;
  const nameOf = (connectionRef: string): string | null => {
    const id = connectionMap[connectionRef];
    const connection = plan.connections.find(
      (item) => item.ref === connectionRef
    );
    return connection?.candidates.find((item) => item.id === id)?.name ?? null;
  };
  const mappingCount = plan.connections.length;
  const boardLines = bundle.boards.map((board) => ({
    board,
    importedTiles: importedTileCount(review, board.ref),
  }));

  return (
    <motion.div
      className="max-h-[440px] min-h-0 overflow-y-auto px-2 pb-2"
      layoutScroll
    >
      <div aria-label="Connections" role="group">
        <SectionLabel>Connections</SectionLabel>
        {plan.connections.map((connection, index) => (
          <StaggerItem index={index} key={connection.ref}>
            <ConnectionMappingRow
              autoFocus={index === 0}
              onMap={handleMap}
              plan={connection}
              selectedId={connectionMap[connection.ref] ?? null}
            />
          </StaggerItem>
        ))}
      </div>
      <div aria-label="Widgets" role="group">
        <SectionLabel>Widgets</SectionLabel>
        {bundle.widgets.map((widget, index) => (
          <StaggerItem index={mappingCount + index} key={widget.ref}>
            <ImportWidgetRow
              autoFocus={mappingCount === 0 && index === 0}
              connectionName={nameOf(widget.connectionRef)}
              onToggle={handleToggleWidget}
              onToggleSql={handleToggleSql}
              state={{
                choice: widgetChoice(review, widget.ref),
                duplicate: isDuplicateHere(review, widget.ref),
                expanded: review.expandedRef === widget.ref,
              }}
              widget={widget}
            />
          </StaggerItem>
        ))}
      </div>
      {boardLines.length > 0 ? (
        <div aria-label="Boards" role="group">
          <SectionLabel>Boards</SectionLabel>
          <StaggerItem index={mappingCount + bundle.widgets.length}>
            <ImportBoardsRow
              checked={review.boards}
              lines={boardLines}
              onToggle={handleToggleBoards}
            />
          </StaggerItem>
        </div>
      ) : null}
    </motion.div>
  );
}
