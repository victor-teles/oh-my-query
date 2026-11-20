import { useCallback } from "react";

import type { ExportScope } from "@/lib/ipc";

import { useFlashMessage } from "@/hooks/use-flash-message";
import { getErrorMessage } from "@/lib/error-message";
import { exportBundle, revealSaved } from "@/lib/ipc";

import { exportedLabel } from "./bundle-labels";

export const EXPORT_FLASH_MS = 6000;

export type ExportOutcome =
  | { kind: "exported"; text: string; savedId: string | null }
  | { kind: "failed"; text: string };

export const useExport = () => {
  const { flash, message: outcome } =
    useFlashMessage<ExportOutcome>(EXPORT_FLASH_MS);

  const run = useCallback(
    async (scope: ExportScope) => {
      try {
        const result = await exportBundle(scope, "file");
        flash({
          kind: "exported",
          savedId: result.savedId,
          text: exportedLabel(result),
        });
      } catch (error) {
        flash({
          kind: "failed",
          text: getErrorMessage(error, "The export failed."),
        });
      }
    },
    [flash]
  );

  const savedId = outcome?.kind === "exported" ? outcome.savedId : null;
  const reveal = useCallback(async () => {
    if (!savedId) {
      return;
    }
    try {
      await revealSaved(savedId);
    } catch (error) {
      flash({
        kind: "failed",
        text: getErrorMessage(error, "The file couldn't be shown."),
      });
    }
  }, [flash, savedId]);

  return { outcome, reveal, run };
};
