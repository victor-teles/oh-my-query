import {
  ClipboardPasteIcon,
  ReplaceIcon,
  RotateCwIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react";
import { useMemo } from "react";

import type { CommandAction } from "@/components/command-palette/types";
import type { ChatMessage } from "@/stores/ai-chat-store";

import { useRegisterCommandActions } from "@/components/command-palette/use-register-command-actions";

const SQL_BLOCK_REGEX = /```(?:sql)?\s*\n([\s\S]*?)```/gi;

const extractLastSqlFromAssistant = (
  messages: ChatMessage[]
): string | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant") {
      continue;
    }
    const matches = [...message.content.matchAll(SQL_BLOCK_REGEX)];
    const last = matches.at(-1);
    if (last?.[1]) {
      return last[1].trim();
    }
  }
  return null;
};

interface AiActionsProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  hasError: boolean;
  hasSelection: () => boolean;
  onInsert: (sql: string) => void;
  onReplaceSelection: (sql: string) => void;
  onClear: () => void;
  onStop: () => void;
  onRetry: () => void;
}

export const AiActions = ({
  messages,
  isStreaming,
  hasError,
  hasSelection,
  onInsert,
  onReplaceSelection,
  onClear,
  onStop,
  onRetry,
}: AiActionsProps) => {
  const lastSql = useMemo(
    () => extractLastSqlFromAssistant(messages),
    [messages]
  );

  const actions = useMemo<CommandAction[]>(
    () => [
      {
        group: "AI",
        icon: ClipboardPasteIcon,
        id: "ai.insert-last-suggestion",
        keywords: ["suggestion", "chat", "code"],
        label: "Insert Last AI Suggestion",
        perform: () => {
          if (lastSql) {
            onInsert(lastSql);
          }
        },
        when: () => lastSql !== null,
      },
      {
        group: "AI",
        icon: ReplaceIcon,
        id: "ai.replace-with-last-suggestion",
        keywords: ["suggestion", "chat"],
        label: "Replace Selection with Last AI Suggestion",
        perform: () => {
          if (lastSql) {
            onReplaceSelection(lastSql);
          }
        },
        when: () => lastSql !== null && hasSelection(),
      },
      {
        group: "AI",
        icon: SquareIcon,
        id: "ai.stop-streaming",
        keywords: ["cancel"],
        label: "Stop AI Streaming",
        perform: onStop,
        when: () => isStreaming,
      },
      {
        group: "AI",
        icon: RotateCwIcon,
        id: "ai.retry",
        label: "Retry Last AI Message",
        perform: onRetry,
        when: () => hasError,
      },
      {
        confirm: true,
        destructive: true,
        group: "AI",
        icon: TrashIcon,
        id: "ai.clear",
        keywords: ["reset", "delete"],
        label: "Clear Chat History",
        perform: onClear,
        when: () => messages.length > 0,
      },
    ],
    [
      lastSql,
      isStreaming,
      hasError,
      messages.length,
      hasSelection,
      onInsert,
      onReplaceSelection,
      onStop,
      onRetry,
      onClear,
    ]
  );

  useRegisterCommandActions(actions, [actions]);

  return null;
};
