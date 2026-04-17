import { useCallback, useEffect, useRef } from "react";

import type { ActiveQuerySnapshot } from "@/contexts/active-query-context";
import type { RedisKey, SchemaInfo } from "@/lib/tauri";
import type { ChatContext } from "@/stores/ai-chat-store";

import { selectConnectionState, useAiChatStore } from "@/stores/ai-chat-store";

export type { ChatMessage } from "@/stores/ai-chat-store";

interface UseAiChatOptions {
  schema: SchemaInfo | null;
  databaseType: string;
  connectionId: string;
  getSnapshot?: () => ActiveQuerySnapshot;
  redisKeys?: RedisKey[] | null;
}

export const useAiChat = ({
  schema,
  databaseType,
  connectionId,
  getSnapshot,
  redisKeys,
}: UseAiChatOptions) => {
  const ensureConnection = useAiChatStore((s) => s.ensureConnection);
  const sendMessageAction = useAiChatStore((s) => s.sendMessage);
  const stopStreamingAction = useAiChatStore((s) => s.stopStreaming);
  const clearErrorAction = useAiChatStore((s) => s.clearError);
  const clearMessagesAction = useAiChatStore((s) => s.clearMessages);
  const retryAction = useAiChatStore((s) => s.retry);

  const state = useAiChatStore(selectConnectionState(connectionId));

  useEffect(() => {
    ensureConnection(connectionId);
  }, [connectionId, ensureConnection]);

  const contextRef = useRef<ChatContext>({
    databaseType,
    getSnapshot,
    redisKeys,
    schema,
  });
  contextRef.current = { databaseType, getSnapshot, redisKeys, schema };

  const sendMessage = useCallback(
    (content: string) =>
      sendMessageAction(connectionId, content, contextRef.current),
    [connectionId, sendMessageAction]
  );

  const stopStreaming = useCallback(
    () => stopStreamingAction(connectionId),
    [connectionId, stopStreamingAction]
  );

  const clearError = useCallback(
    () => clearErrorAction(connectionId),
    [connectionId, clearErrorAction]
  );

  const clearMessages = useCallback(
    () => clearMessagesAction(connectionId),
    [connectionId, clearMessagesAction]
  );

  const retry = useCallback(
    () => retryAction(connectionId, contextRef.current),
    [connectionId, retryAction]
  );

  return {
    clearError,
    clearMessages,
    error: state.error,
    isStreaming: state.isStreaming,
    messages: state.messages,
    retry,
    sendMessage,
    stopStreaming,
  };
};
