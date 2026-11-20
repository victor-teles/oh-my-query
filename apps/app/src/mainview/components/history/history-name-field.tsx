import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import { NameField } from "@/components/widgets/name-field";

import type { HistorySave } from "./use-history-save";

interface HistoryNameFieldProps {
  save: HistorySave;
  onDone: () => void;
}

export function HistoryNameField({ save, onDone }: HistoryNameFieldProps) {
  const handleConfirm = useCallback(
    (name: string) => {
      save.confirm(name);
      onDone();
    },
    [onDone, save]
  );
  const handleCancel = useCallback(() => {
    save.cancel();
    onDone();
  }, [onDone, save]);

  return (
    <AnimatePresence initial={false}>
      {save.naming ? (
        <NameField
          initial={save.initialName}
          key="widget-name"
          label="Widget name"
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      ) : null}
    </AnimatePresence>
  );
}
