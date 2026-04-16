import type { ChatMessage } from "@/hooks/use-ai-chat";

const STORAGE_KEY_PREFIX = "oh-my-query-chat-history-";
const MAX_MESSAGES = 50;

const isMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
};

export const getChatHistory = (connectionId: string): ChatMessage[] => {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${connectionId}`);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMessage);
  } catch {
    return [];
  }
};

export const saveChatHistory = (
  connectionId: string,
  messages: readonly ChatMessage[]
): void => {
  const trimmed = messages.slice(-MAX_MESSAGES);
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${connectionId}`,
    JSON.stringify(trimmed)
  );
};

export const clearChatHistory = (connectionId: string): void => {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${connectionId}`);
};
