import type { FocusEvent, KeyboardEvent } from "react";

import { motion } from "motion/react";
import { useCallback, useLayoutEffect, useRef } from "react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { DrillSegment } from "@/lib/drill";

import {
  ActionMenuItem,
  actionItemId,
} from "@/components/launcher/actions/action-menu-item";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useMotionPreset } from "@/lib/motion";

export interface DrillItem extends MenuAction {
  segment: DrillSegment;
}

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
const LIST_LABEL = "Drill into…";

interface DrillListProps {
  items: readonly DrillItem[];
  onPick: (item: DrillItem) => void;
  onClose: () => void;
}

export function DrillList({ items, onPick, onClose }: DrillListProps) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const listRef = useRef<HTMLDivElement>(null);
  const { move, select, selected } = useListSelection(items);

  useLayoutEffect(() => {
    listRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (selected) {
      document
        .querySelector(`#${CSS.escape(actionItemId(selected.id))}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

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
          onPick(selected);
        }
        return;
      }
      const toggled = event.key === "d" && event.metaKey;
      if (event.key === "Escape" || event.key === "Tab" || toggled) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    },
    [move, onClose, onPick, selected]
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
      aria-label={LIST_LABEL}
      className="absolute top-12 right-3 z-20 flex max-h-72 w-72 origin-top-right flex-col rounded-[12px] popover-material p-1.5 outline-none"
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={listRef}
      role="menu"
      tabIndex={-1}
      transition={{ ...snappy, opacity: fadeIn }}
    >
      <div
        aria-hidden
        className="flex h-7 shrink-0 items-center px-2.5 type-micro text-panel-muted"
      >
        {LIST_LABEL}
      </div>
      <div className="min-h-0 overflow-y-auto">
        {items.map((item) => (
          <ActionMenuItem
            action={item}
            armed={false}
            highlighted={item.id === selected?.id}
            key={item.id}
            onHighlight={select}
            onRun={onPick}
          />
        ))}
      </div>
    </motion.div>
  );
}
