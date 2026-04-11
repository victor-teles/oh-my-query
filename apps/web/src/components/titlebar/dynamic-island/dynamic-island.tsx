import { AnimatePresence, motion } from "motion/react";

import { TRAFFIC_LIGHT_INSET } from "@/components/titlebar/titlebar";
import { useIsland } from "@/contexts/island-context";
import { isTauri } from "@/lib/tauri";

import { DynamicIslandContent } from "./dynamic-island-content";

const SPRING = { damping: 30, stiffness: 400, type: "spring" } as const;

export const AppIsland = () => {
  const { snapshot } = useIsland();
  const isHidden = snapshot.kind === "hidden";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 isolate z-50 flex h-9.5 select-none">
      {isTauri() && <div style={{ width: TRAFFIC_LIGHT_INSET }} />}
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence>
          {!isHidden && (
            <motion.div
              key="island"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              whileHover={{
                boxShadow:
                  "0 0 0 1px color-mix(in oklch, var(--border) 80%, transparent)",
              }}
              className="pointer-events-auto flex h-6 items-center rounded-full border border-border/60 bg-background px-2.5 shadow-sm backdrop-blur-xl backdrop-saturate-200"
            >
              <DynamicIslandContent snapshot={snapshot} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
