import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import { ErrorNotice } from "@/components/ask/error-notice";
import { ViewHeader } from "@/components/launcher/view-header";
import { useMotionPreset } from "@/lib/motion";

import type { ImportState } from "./import-reducer";
import type { Importer } from "./use-import";

import { ImportFooter } from "./import-footer";
import { isReview } from "./import-reducer";
import { ImportReview } from "./import-review";
import { ImportSources } from "./import-sources";
import { ImportSummary } from "./import-summary";
import { useImport } from "./use-import";
import { useImportKeyboard } from "./use-import-keyboard";

const bodyKey = (state: ImportState): string => {
  if (isReview(state)) {
    return "review";
  }
  return state.phase === "done" ? "done" : "start";
};

interface ImportBodyProps {
  importer: Importer;
  onFinish: () => void;
}

function ImportBody({ importer, onFinish }: ImportBodyProps) {
  const { state, read, apply, edits } = importer;
  if (state.phase === "done") {
    return <ImportSummary onDone={onFinish} result={state.result} />;
  }
  if (isReview(state)) {
    return (
      <>
        <ImportReview edits={edits} review={state} />
        {state.phase === "error" ? (
          <ErrorNotice
            action={{ label: "Retry", onRun: apply }}
            detail={state.message}
            title="The import didn't finish."
          />
        ) : null}
      </>
    );
  }
  return (
    <>
      <ImportSources
        onRead={read}
        reading={state.phase === "reading" ? state.source : null}
      />
      {state.phase === "invalid" ? (
        <ErrorNotice
          action={null}
          detail={state.message}
          title="Couldn't read the export."
        />
      ) : null}
    </>
  );
}

interface ImportViewProps {
  onBack: () => void;
  onDone: (firstWidgetId: string | null) => void;
}

export function ImportView({ onBack, onDone }: ImportViewProps) {
  const importer = useImport();
  const { state } = importer;
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const handleKeyDown = useImportKeyboard({
    onImport: importer.apply,
    onToggleSql: importer.edits.toggleSql,
  });
  const handleFinish = useCallback(() => {
    onDone(
      state.phase === "done"
        ? (state.result.importedWidgetIds[0] ?? null)
        : null
    );
  }, [onDone, state]);

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown}>
      <ViewHeader onBack={onBack} title="Import Widgets and Boards" />
      <div className="relative flex min-h-0 flex-1 flex-col border-t border-panel-border">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-col"
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : fadeOut,
            }}
            initial={reduced ? false : { opacity: 0 }}
            key={bodyKey(state)}
            transition={fadeIn}
          >
            <ImportBody importer={importer} onFinish={handleFinish} />
          </motion.div>
        </AnimatePresence>
      </div>
      <ImportFooter state={state} />
    </div>
  );
}
