import type { ReactNode } from "react";

import { LayoutGroup, motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";

import type { Presence } from "./use-launcher-presence";

import { useWindowHeightSync } from "./use-window-height-sync";

export const PANEL_MARGIN = 20;
const PANEL_MAX_HEIGHT = 680;

interface LauncherSurfaceProps {
  presence: Presence;
  onPresenceSettled: (definition: unknown) => void;
  children: ReactNode;
}

export function LauncherSurface({
  presence,
  onPresenceSettled,
  children,
}: LauncherSurfaceProps) {
  const { reduced, soft, fadeOut, fadeIn } = useMotionPreset();
  const { panelRef, settle } = useWindowHeightSync({
    margin: PANEL_MARGIN,
    reduced,
  });

  const variants = reduced
    ? {
        hidden: { opacity: 0, transition: { duration: 0 } },
        shown: { opacity: 1, transition: fadeIn },
      }
    : {
        hidden: {
          opacity: 0,
          scale: 0.98,
          transition: { ...soft, opacity: fadeOut },
          y: -8,
        },
        shown: { opacity: 1, scale: 1, transition: soft, y: 0 },
      };

  return (
    <div
      className="flex h-screen w-screen items-start justify-center"
      style={{ padding: PANEL_MARGIN }}
    >
      <motion.div
        animate={presence}
        className="flex w-full flex-col overflow-hidden launcher-material"
        data-presence={presence}
        initial="hidden"
        layout
        onAnimationComplete={onPresenceSettled}
        onLayoutAnimationComplete={settle}
        ref={panelRef}
        style={{
          borderRadius: 16,
          maxHeight: PANEL_MAX_HEIGHT,
          originX: 0.5,
          originY: 0,
          pointerEvents: presence === "shown" ? "auto" : "none",
        }}
        transition={{ layout: soft }}
        variants={variants}
      >
        <LayoutGroup>{children}</LayoutGroup>
      </motion.div>
    </div>
  );
}
