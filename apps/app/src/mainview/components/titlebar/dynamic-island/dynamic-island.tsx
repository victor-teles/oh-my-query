import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import type { IslandSnapshot } from "@/contexts/island-context";

import { TRAFFIC_LIGHT_INSET } from "@/components/titlebar/titlebar";
import { useIsland } from "@/contexts/island-context";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { DynamicIslandContent } from "./dynamic-island-content";

const SPRING = { damping: 30, stiffness: 400, type: "spring" } as const;

const isErrorKind = (kind: IslandSnapshot["kind"]): boolean =>
  kind === "connection-error" || kind === "query-error";

const getCancelHandler = (
  snapshot: IslandSnapshot
): (() => void) | undefined => {
  if (
    snapshot.kind === "query-running" ||
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
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 isolate z-50 flex h-9.5 select-none">
      {isTauri() && <div style={{ width: TRAFFIC_LIGHT_INSET }} />}
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence>
          {!isHidden && (
            <motion.div
              key="island"
              layout
              role={isError ? "alert" : "status"}
              aria-live={isError ? "assertive" : "polite"}
              aria-atomic="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className={cn(
                "pointer-events-auto relative flex h-6 items-center rounded-full border bg-background/85 px-2.5 shadow-sm backdrop-blur-xl backdrop-saturate-200",
                isError ? "border-destructive/30" : "border-border/60"
              )}
            >
              <DynamicIslandContent snapshot={snapshot} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
