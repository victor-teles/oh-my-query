import { AnimatePresence } from "motion/react";

import type { ExportOutcome } from "@/components/bundle/use-export";

import { ExportStatus } from "@/components/bundle/export-status";
import { ConnectionStatus } from "@/components/launcher/connection-status";

interface RootStatusProps {
  outcome: ExportOutcome | null;
  onReveal: () => void;
}

export function RootStatus({ outcome, onReveal }: RootStatusProps) {
  return (
    <>
      {outcome ? null : <ConnectionStatus />}
      <AnimatePresence mode="popLayout">
        {outcome ? (
          <ExportStatus key="export" onReveal={onReveal} outcome={outcome} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
