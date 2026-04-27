import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { useSettingsFeedback } from "./settings-feedback-context";

const VISIBLE_MS = 1500;

export const SavedIndicator = () => {
  const { lastSavedAt } = useSettingsFeedback();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lastSavedAt === null) {
      return;
    }
    setVisible(true);
    const id = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [lastSavedAt]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          aria-live="polite"
          className="pointer-events-none absolute top-5 right-6 flex items-center gap-1.5 text-xs font-medium text-primary"
          exit={{ opacity: 0 }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          key={lastSavedAt}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="size-1.5 rounded-full bg-primary" />
          Saved
        </motion.div>
      )}
    </AnimatePresence>
  );
};
