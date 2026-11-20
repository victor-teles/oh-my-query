import type { FocusEvent, KeyboardEvent } from "react";

import { motion } from "motion/react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { useListSelection } from "@/components/launcher/use-list-selection";
import { useMotionPreset } from "@/lib/motion";

import type { MenuAction } from "./menu-action";

import { ActionMenuItem, actionItemId } from "./action-menu-item";

const HEADER_HEIGHT = 28;
const ITEM_HEIGHT = 32;
const CHROME = 14;
const GUTTER = 12;

export const actionsMenuHeight = (count: number) =>
  HEADER_HEIGHT + count * ITEM_HEIGHT + CHROME + GUTTER * 2;

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

// Anchors the scale origin at the anchor's trailing edge so the menu grows
// out of the element it acts on.
const useOriginAt = (anchorId: string) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const anchor = document.querySelector(`#${CSS.escape(anchorId)}`);
    if (anchor) {
      const menuBox = menu.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const y = anchorBox.top + anchorBox.height / 2 - menuBox.top;
      menu.style.transformOrigin = `${anchorBox.right - menuBox.left}px ${y}px`;
    }
    menu.focus();
  }, [anchorId]);
  return menuRef;
};

interface ActionsMenuProps<A extends MenuAction> {
  title: string;
  anchorId: string;
  actions: readonly A[];
  armedId: string | null;
  onRun: (action: A) => void;
  onClose: () => void;
}

export function ActionsMenu<A extends MenuAction>({
  title,
  anchorId,
  actions,
  armedId,
  onRun,
  onClose,
}: ActionsMenuProps<A>) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const menuRef = useOriginAt(anchorId);
  const { move, select, selected } = useListSelection(actions);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = STEPS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        move(step);
        return;
      }
      if (event.key === "Enter" && selected) {
        event.preventDefault();
        if (!selected.disabled) {
          onRun(selected);
        }
        return;
      }
      const toggled = event.key === "k" && event.metaKey;
      if (event.key === "Escape" || event.key === "Tab" || toggled) {
        event.preventDefault();
        onClose();
      }
    },
    [move, onClose, onRun, selected]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        onClose();
      }
    },
    [onClose]
  );

  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      aria-activedescendant={selected ? actionItemId(selected.id) : undefined}
      aria-label={`Actions for ${title}`}
      className="absolute right-3 bottom-3 z-10 w-64 rounded-[12px] popover-material p-1.5 outline-none"
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      transition={{ ...snappy, opacity: fadeIn }}
    >
      <div
        aria-hidden
        className="flex h-7 items-center truncate px-2.5 type-micro text-panel-muted"
      >
        {title}
      </div>
      {actions.map((action) => (
        <ActionMenuItem
          action={action}
          armed={action.id === armedId}
          highlighted={action.id === selected?.id}
          key={action.id}
          onHighlight={select}
          onRun={onRun}
        />
      ))}
    </motion.div>
  );
}
