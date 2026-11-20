import { useCallback, useState } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { DatabaseConnection } from "@/lib/connections";
import type { RecentAsk } from "@/lib/ipc";

import { useFlashMessage } from "@/hooks/use-flash-message";
import { copyText } from "@/lib/clipboard";
import { getErrorMessage } from "@/lib/error-message";

import type { HistoryMatch } from "./history-search";
import type { HistoryState } from "./use-history";

import { historyTarget } from "./history-actions";
import { useHistorySave } from "./use-history-save";

export interface HistoryAskActions {
  start: (prompt: string, target: AskTarget) => void;
  startSql: (sql: string, target: AskTarget) => void;
}

interface UseHistoryCommandsOptions {
  history: Pick<HistoryState, "remove" | "clear">;
  items: readonly HistoryMatch[];
  selected: HistoryMatch | null;
  connections: {
    all: readonly DatabaseConnection[];
    active: DatabaseConnection | null;
  };
  ask: HistoryAskActions;
  select: (id: string | null) => void;
}

const neighbourOf = (items: readonly HistoryMatch[], id: string) => {
  const index = items.findIndex((item) => item.id === id);
  return items[index + 1] ?? items[index - 1] ?? null;
};

export const useHistoryCommands = ({
  history,
  items,
  selected,
  connections,
  ask,
  select,
}: UseHistoryCommandsOptions) => {
  const { flash, message } = useFlashMessage();
  const [failure, setFailure] = useState<string | null>(null);
  const notify = useCallback(
    (next: string) => {
      setFailure(null);
      flash(next);
    },
    [flash]
  );
  const save = useHistorySave({
    onFailed: setFailure,
    onSaved: () => notify("Saved · in Widgets"),
  });

  const record = selected?.entry.ask ?? null;
  const targetOf = (chosen: RecentAsk) =>
    historyTarget(chosen, connections.all, connections.active);
  const target = record ? targetOf(record) : null;

  const askOne = (chosen: RecentAsk | null) => {
    const resolved = chosen ? targetOf(chosen) : null;
    if (chosen && resolved) {
      ask.start(chosen.prompt, resolved.target);
    }
  };

  const copy = async (text: string, done: string) => {
    if (await copyText(text)) {
      notify(done);
    } else {
      setFailure("Couldn't copy to the clipboard.");
    }
  };

  const remove = async () => {
    if (!record) {
      return;
    }
    select(neighbourOf(items, record.id)?.id ?? null);
    try {
      await history.remove(record.id);
      notify("Removed from history");
    } catch (error) {
      setFailure(getErrorMessage(error, "The ask couldn't be removed."));
    }
  };

  const clear = async () => {
    try {
      await history.clear();
      notify("History cleared");
    } catch (error) {
      setFailure(getErrorMessage(error, "History couldn't be cleared."));
    }
  };

  return {
    askAgain: () => askOne(record),
    askById: (askId: string) =>
      askOne(items.find((item) => item.id === askId)?.entry.ask ?? null),
    beginSave: () => record && save.begin(record),
    clear,
    copyPrompt: () => record && copy(record.prompt, "Copied prompt"),
    copySql: () => record && copy(record.sql, "Copied SQL"),
    remove,
    runSql: () => {
      if (record && target?.fallback === null) {
        ask.startSql(record.sql, target.target);
      }
    },
    save,
    status: { failure, message },
    target,
  };
};

export type HistoryCommands = ReturnType<typeof useHistoryCommands>;
