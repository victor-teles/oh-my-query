import type { QueryLanguage } from "@conch/core/client";

import { isSqlDialect } from "@conch/core/client";
import {
  BookmarkPlusIcon,
  ClipboardCopyIcon,
  CornerDownLeftIcon,
  MessageSquareTextIcon,
  PlayIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { DatabaseConnection } from "@/lib/connections";
import type { RecentAsk } from "@/lib/ipc";

export type HistoryActionId =
  | "ask-again"
  | "run-sql"
  | "copy-sql"
  | "copy-prompt"
  | "save-widget"
  | "remove"
  | "clear";

export interface HistoryAction extends MenuAction {
  id: HistoryActionId;
}

export interface HistoryTarget {
  target: AskTarget;
  fallback: DatabaseConnection | null;
}

export const historyTarget = (
  ask: RecentAsk,
  connections: readonly DatabaseConnection[],
  active: DatabaseConnection | null
): HistoryTarget | null => {
  if (connections.some((connection) => connection.id === ask.connectionId)) {
    return {
      fallback: null,
      target: { connectionId: ask.connectionId, database: ask.database },
    };
  }
  return active
    ? { fallback: active, target: { connectionId: active.id, database: null } }
    : null;
};

// Stored SQL only runs where it was written; asking again rewrites it.
// Pipelines and Redis plans can be asked again but never run raw or saved.
export const historyActions = (
  target: HistoryTarget | null,
  language: QueryLanguage | null = null
): HistoryAction[] => {
  const isSql = language === null || isSqlDialect(language);
  return [
    {
      disabled: target === null,
      icon: CornerDownLeftIcon,
      id: "ask-again",
      keys: ["↩"],
      label: "Ask Again",
      tone: "default",
    },
    {
      disabled: target?.fallback !== null || !isSql,
      icon: PlayIcon,
      id: "run-sql",
      label: "Run SQL (no AI)",
      tone: "default",
    },
    {
      icon: ClipboardCopyIcon,
      id: "copy-sql",
      keys: ["⌘", "C"],
      label: "Copy SQL",
      tone: "default",
    },
    {
      icon: MessageSquareTextIcon,
      id: "copy-prompt",
      label: "Copy Prompt",
      tone: "default",
    },
    {
      disabled: !isSql,
      icon: BookmarkPlusIcon,
      id: "save-widget",
      keys: ["⌘", "S"],
      label: "Save as Widget…",
      tone: "default",
    },
    {
      icon: XIcon,
      id: "remove",
      keys: ["⌃", "X"],
      label: "Remove from History",
      tone: "destructive",
    },
    {
      icon: Trash2Icon,
      id: "clear",
      label: "Clear History…",
      tone: "destructive",
    },
  ];
};
