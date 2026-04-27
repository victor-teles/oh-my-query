import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface ConnectionsErrorStateProps {
  error: Error;
  onResetSecrets: () => Promise<void>;
  onRetry: () => void;
}

const ConnectionsErrorState = ({
  error,
  onResetSecrets,
  onRetry,
}: ConnectionsErrorStateProps) => {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const startConfirm = useCallback(() => setConfirmingReset(true), []);
  const cancelConfirm = useCallback(() => setConfirmingReset(false), []);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await onResetSecrets();
    } finally {
      setIsResetting(false);
      setConfirmingReset(false);
    }
  }, [onResetSecrets]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="w-full max-w-md"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Empty className="p-0">
        <EmptyMedia variant="icon">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle as="h2" className="text-base">
            Couldn&apos;t load your connections
          </EmptyTitle>
          <EmptyDescription>
            {error.message ||
              "Your encrypted store couldn't be opened with the current key."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-2">
          <Button autoFocus onClick={onRetry} size="default" variant="outline">
            <RotateCcw />
            Try again
          </Button>
          {confirmingReset ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">
                This deletes your saved connections and query history. This
                cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={isResetting}
                  onClick={cancelConfirm}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isResetting}
                  onClick={handleReset}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 />
                  {isResetting ? "Resetting…" : "Reset secrets"}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={startConfirm} size="sm" variant="ghost">
              Reset secrets
            </Button>
          )}
        </EmptyContent>
      </Empty>
    </motion.div>
  );
};

export { ConnectionsErrorState };
