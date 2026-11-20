import { AnimatePresence } from "motion/react";

import type { CardSlots } from "@/components/ask/ask-card";

import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { CardActionsButton } from "@/components/result-actions/card-actions-button";
import { CopiedRing } from "@/components/result-actions/copied-ring";

import type { AskActionsMenu } from "./use-ask-actions-menu";
import type { AskDrill } from "./use-ask-drill";

import { DrillList } from "./drill-list";
import { ASK_ACTIONS_ANCHOR_ID } from "./use-ask-actions-menu";

const DRILL_LIST_TOP = 56;
const DRILL_LIST_ROWS = 8;

// The scroll area grows to fit whichever card popover is open.
export const askOverlayHeight = (menu: AskActionsMenu, drill: AskDrill) =>
  Math.max(
    menu.open ? actionsMenuHeight(menu.actions.length) : 0,
    drill.open
      ? actionsMenuHeight(Math.min(drill.items.length, DRILL_LIST_ROWS)) +
          DRILL_LIST_TOP
      : 0
  );

export const askCardSlots = (
  { open, toggle: handleToggle, exporter }: AskActionsMenu,
  { open: drilling, items, pick: handlePick, close: handleClose }: AskDrill
): CardSlots => ({
  actions: (
    <CardActionsButton
      expanded={open}
      id={ASK_ACTIONS_ANCHOR_ID}
      onToggle={handleToggle}
    />
  ),
  overlay: (
    <>
      <CopiedRing copies={exporter.chartCopies} />
      <AnimatePresence>
        {drilling ? (
          <DrillList items={items} onClose={handleClose} onPick={handlePick} />
        ) : null}
      </AnimatePresence>
    </>
  ),
});

interface AskActionsLayerProps {
  menu: AskActionsMenu;
  title: string;
}

export function AskActionsLayer({ menu, title }: AskActionsLayerProps) {
  const { close: handleClose, run: handleRun } = menu;
  return (
    <AnimatePresence>
      {menu.open ? (
        <ActionsMenu
          actions={menu.actions}
          anchorId={ASK_ACTIONS_ANCHOR_ID}
          armedId={null}
          onClose={handleClose}
          onRun={handleRun}
          title={title}
        />
      ) : null}
    </AnimatePresence>
  );
}
