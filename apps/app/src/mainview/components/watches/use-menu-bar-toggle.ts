import { newWatchDraft, watchDraftOf } from "@oh-my-query/rpc";
import { useCallback } from "react";

import type { Widget } from "@/lib/ipc";

import { editableValues } from "./use-watch-form";
import { useWatches, watchForWidget } from "./watches-provider";

// Pinning an unwatched KPI starts watching it with the default interval.
export const useMenuBarToggle = () => {
  const { watches, save } = useWatches();
  return useCallback(
    async (widget: Widget): Promise<boolean> => {
      const watch = watchForWidget(watches, widget.id);
      const draft = watch
        ? { ...watchDraftOf(watch), menuBar: !watch.menuBar }
        : {
            ...newWatchDraft(widget.id, editableValues(widget)),
            menuBar: true,
          };
      await save(draft);
      return draft.menuBar;
    },
    [save, watches]
  );
};
