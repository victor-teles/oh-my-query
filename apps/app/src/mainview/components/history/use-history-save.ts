import type { DialectType } from "@oh-my-query/core/client";

import { isSqlDialect } from "@oh-my-query/core/client";
import { useState } from "react";

import type { RecentAsk, WidgetDraft } from "@/lib/ipc";

import {
  defaultWidgetName,
  draftFromAsk,
} from "@/components/widgets/widget-draft";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { viewKindOf } from "@/lib/card-data";
import { getErrorMessage } from "@/lib/error-message";

export type SqlRecentAsk = RecentAsk & { dialect: DialectType };

export const isSqlRecent = (ask: RecentAsk): ask is SqlRecentAsk =>
  isSqlDialect(ask.dialect);

export const draftFromHistory = (
  ask: SqlRecentAsk,
  name: string
): WidgetDraft => ({
  ...draftFromAsk(
    {
      connectionId: ask.connectionId,
      dialect: ask.dialect,
      prompt: ask.prompt,
      spec: ask.spec,
      sql: ask.sql,
      view: viewKindOf(ask.spec.view),
    },
    name
  ),
  database: ask.database,
});

interface UseHistorySaveOptions {
  onSaved: () => void;
  onFailed: (message: string) => void;
}

export const useHistorySave = ({
  onSaved,
  onFailed,
}: UseHistorySaveOptions) => {
  const { save, markFresh } = useWidgets();
  const [naming, setNaming] = useState<SqlRecentAsk | null>(null);

  const confirm = async (name: string) => {
    if (!naming) {
      return;
    }
    setNaming(null);
    try {
      const widget = await save(draftFromHistory(naming, name));
      markFresh(widget.id);
      onSaved();
    } catch (error) {
      onFailed(getErrorMessage(error, "The widget could not be saved."));
    }
  };

  return {
    begin: (ask: RecentAsk) => {
      if (isSqlRecent(ask)) {
        setNaming(ask);
      }
    },
    cancel: () => setNaming(null),
    confirm,
    initialName: naming ? defaultWidgetName(naming.spec) : "",
    naming: naming !== null,
  };
};

export type HistorySave = ReturnType<typeof useHistorySave>;
