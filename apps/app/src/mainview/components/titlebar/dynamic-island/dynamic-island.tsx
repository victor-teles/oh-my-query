import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import type { IslandSnapshot } from "@/contexts/island-context";

import { TRAFFIC_LIGHT_INSET } from "@/components/titlebar/titlebar";
import { useIsland } from "@/contexts/island-context";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { DynamicIslandContent } from "./dynamic-island-content";
import {
  CONTENT_CROSSFADE_ANIMATE,
  CONTENT_CROSSFADE_INITIAL,
  CONTENT_CROSSFADE_TRANSITION,
  PILL_LAYOUT_TRANSITION,
  PILL_PRESENCE_TRANSITION,
} from "./island-motion";

const isErrorKind = (kind: IslandSnapshot["kind"]): boolean =>
  kind === "connection-error" || kind === "query-error";

const getCancelHandler = (
  snapshot: IslandSnapshot
): (() => void) | undefined => {
  if (snapshot.kind === "query-running") {
    return snapshot.onCancelHeadline;
  }
  if (
    snapshot.kind === "query-streaming" ||
    snapshot.kind === "query-planning"
  ) {
    return snapshot.onCancel;
  }
  return undefined;
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
};

const isInsideIslandPicker = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest("[data-island-picker]") !== null;
};

export const AppIsland = () => {
  const { snapshot } = useIsland();
  const isHidden = snapshot.kind === "hidden";
  const isError = isErrorKind(snapshot.kind);
  const onCancel = getCancelHandler(snapshot);

  useEffect(() => {
    if (!onCancel) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      if (isInteractiveTarget(event.target)) {
        return;
      }
      if (
        isInsideIslandPicker(event.target) ||
        document.querySelector("[data-island-picker]")
      ) {
        return;
      }
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="
        pointer-events-none fixed inset-x-0 top-0 isolate z-50 flex h-9.5
        select-none
      "
    >
      {isTauri() && <div style={{ width: TRAFFIC_LIGHT_INSET }} />}
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence>
          {!isHidden && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              aria-atomic="true"
              aria-live={isError ? "assertive" : "polite"}
              className={cn(`
                  pointer-events-auto relative flex h-6 items-center
                  overflow-hidden rounded-full border bg-background/85 px-2.5
                  shadow-sm backdrop-blur-xl backdrop-saturate-200
                `, isError ? "border-destructive/30" : "border-border/60")}
              exit={{ opacity: 0, scale: 0.9 }}
              initial={{ opacity: 0, scale: 0.9 }}
              key="island"
              layout
              role={isError ? "alert" : "status"}
              transition={{
                layout: PILL_LAYOUT_TRANSITION,
                opacity: PILL_PRESENCE_TRANSITION,
                scale: PILL_PRESENCE_TRANSITION,
              }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  animate={CONTENT_CROSSFADE_ANIMATE}
                  className="flex items-center gap-1.5"
                  exit={CONTENT_CROSSFADE_INITIAL}
                  initial={CONTENT_CROSSFADE_INITIAL}
                  key={snapshot.kind}
                  transition={CONTENT_CROSSFADE_TRANSITION}
                >
                  <DynamicIslandContent snapshot={snapshot} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
