import { motion } from "motion/react";
import { useCallback } from "react";

import { KeyCombo } from "@/components/launcher/key-combo";
import { SwapText } from "@/components/motion/swap-text";
import { CONFIRM_WINDOW_MS } from "@/hooks/use-armed-confirm";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { MenuAction } from "./menu-action";

import { DELETE_CONFIRM_LABEL } from "./menu-action";

export const actionItemId = (id: string) => `launcher-action-${id}`;

function DrainingHairline() {
  const { reduced } = useMotionPreset();
  return (
    <motion.span
      animate={{ scaleX: reduced ? 1 : 0 }}
      aria-hidden
      className="absolute inset-x-2.5 bottom-1 h-px origin-left bg-danger-ink"
      data-testid="confirm-timer"
      initial={{ scaleX: 1 }}
      transition={{ duration: CONFIRM_WINDOW_MS / 1000, ease: "linear" }}
    />
  );
}

interface ActionMenuItemProps<A extends MenuAction> {
  action: A;
  highlighted: boolean;
  armed: boolean;
  onHighlight: (id: string) => void;
  onRun: (action: A) => void;
}

export function ActionMenuItem<A extends MenuAction>({
  action,
  highlighted,
  armed,
  onHighlight,
  onRun,
}: ActionMenuItemProps<A>) {
  const { snappy, pressed, press } = useMotionPreset();
  const handleClick = useCallback(() => {
    if (!action.disabled) {
      onRun(action);
    }
  }, [onRun, action]);
  const handlePointerMove = useCallback(
    () => onHighlight(action.id),
    [onHighlight, action.id]
  );
  const destructive = action.tone === "destructive";
  const Icon = action.icon;

  return (
    <motion.div
      aria-disabled={action.disabled}
      className={cn(
        "relative flex h-8 cursor-default items-center gap-2.5 px-2.5 type-body",
        destructive ? "text-danger-ink" : "text-foreground",
        action.disabled && "text-panel-muted"
      )}
      id={actionItemId(action.id)}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      role="menuitem"
      whileTap={{ ...pressed, transition: press }}
    >
      {highlighted ? (
        <motion.span
          className={cn(
            "absolute inset-0 rounded-[8px]",
            destructive && armed ? "bg-destructive/16" : "bg-row-active"
          )}
          layoutId="launcher-action-highlight"
          transition={snappy}
        />
      ) : null}
      <Icon aria-hidden className="relative size-3.5 shrink-0 opacity-80" />
      <SwapText
        className="relative min-w-0 flex-1 truncate"
        value={armed ? DELETE_CONFIRM_LABEL : action.label}
      />
      {action.keys && !armed ? (
        <KeyCombo className="relative shrink-0" keys={action.keys} />
      ) : null}
      {armed ? <DrainingHairline /> : null}
    </motion.div>
  );
}
