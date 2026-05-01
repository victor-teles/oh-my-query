import { streamText } from "ai";
import { create } from "zustand";

import type { ActiveQuerySnapshot } from "@/contexts/active-query-context";
import type { AIError } from "@/lib/ai-errors";
import type { SchemaRedactOptions } from "@/lib/ai-schema-formatter";
import type { RedisKey, SchemaInfo } from "@/lib/tauri";

import { formatActiveQueryContext } from "@/lib/ai-context";
import { classifyAIError } from "@/lib/ai-errors";
import { createAIModel } from "@/lib/ai-provider";
import { buildSystemPrompt } from "@/lib/ai-schema-formatter";
import { getAISettings } from "@/lib/ai-settings";
import {
  clearChatHistory,
  getChatHistory,
  saveChatHistory,
} from "@/lib/chat-history";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  schema: SchemaInfo | null;
  databaseType: string;
  getSnapshot?: () => ActiveQuerySnapshot;
  redisKeys?: RedisKey[] | null;
  redact?: SchemaRedactOptions;
}

interface ChatConnectionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: AIError | null;
  lastUserMessage: string | null;
  abortController: AbortController | null;
}

interface AiChatStore {
  byConnection: Record<string, ChatConnectionState>;
  ensureConnection: (connectionId: string) => void;
  sendMessage: (
    connectionId: string,
    content: string,
    context: ChatContext
  ) => Promise<void>;
  stopStreaming: (connectionId: string) => void;
  clearError: (connectionId: string) => void;
  clearMessages: (connectionId: string) => void;
  retry: (connectionId: string, context: ChatContext) => void;
}

const NOT_CONFIGURED_ERROR: AIError = {
  message: "AI is not configured.",
  retryable: false,
  suggestion: "Set up your API key in AI settings to start chatting.",
  type: "auth",
};

const EMPTY_STATE: ChatConnectionState = {
  abortController: null,
  error: null,
  isStreaming: false,
  lastUserMessage: null,
  messages: [],
};

export const useAiChatStore = create<AiChatStore>((set, get) => {
  const patch = (
    connectionId: string,
    updater:
      | Partial<ChatConnectionState>
      | ((prev: ChatConnectionState) => Partial<ChatConnectionState>)
  ) => {
    set((state) => {
      const prev = state.byConnection[connectionId] ?? EMPTY_STATE;
      const next = typeof updater === "function" ? updater(prev) : updater;
      return {
        byConnection: {
          ...state.byConnection,
          [connectionId]: { ...prev, ...next },
        },
      };
    });
  };

  return {
    byConnection: {},

    clearError: (connectionId) => {
      patch(connectionId, { error: null });
    },

    clearMessages: (connectionId) => {
      clearChatHistory(connectionId);
      get().byConnection[connectionId]?.abortController?.abort();
      patch(connectionId, {
        abortController: null,
        error: null,
        isStreaming: false,
        lastUserMessage: null,
        messages: [],
      });
    },

    ensureConnection: (connectionId) => {
      if (get().byConnection[connectionId]) {
        return;
      }
      const restored = getChatHistory(connectionId);
      set((state) => ({
        byConnection: {
          ...state.byConnection,
          [connectionId]: { ...EMPTY_STATE, messages: restored },
        },
      }));
    },

    retry: (connectionId, context) => {
      const last = get().byConnection[connectionId]?.lastUserMessage;
      if (last) {
        get().sendMessage(connectionId, last, context);
      }
    },

    sendMessage: async (connectionId, content, context) => {
      const settings = await getAISettings();
      if (!settings) {
        patch(connectionId, { error: NOT_CONFIGURED_ERROR });
        return;
      }

      const prevMessages = get().byConnection[connectionId]?.messages ?? [];

      const userMessage: ChatMessage = {
        content,
        id: crypto.randomUUID(),
        role: "user",
      };
      const assistantMessage: ChatMessage = {
        content: "",
        id: crypto.randomUUID(),
        role: "assistant",
      };

      const abortController = new AbortController();

      patch(connectionId, {
        abortController,
        error: null,
        isStreaming: true,
        lastUserMessage: content,
        messages: [...prevMessages, userMessage, assistantMessage],
      });

      try {
        const model = createAIModel(settings);
        const baseSystem = context.schema
          ? buildSystemPrompt(
              context.schema,
              context.databaseType,
              context.redisKeys ?? null,
              context.redact
            )
          : `You are a SQL assistant for a ${context.databaseType} database. Help users write queries, explain SQL, diagnose errors, and suggest optimizations. Wrap SQL in \`\`\`sql code blocks.`;

        const contextBlock = context.getSnapshot
          ? formatActiveQueryContext(context.getSnapshot())
          : null;
        const system = contextBlock
          ? `${baseSystem}\n\n${contextBlock}`
          : baseSystem;

        const allMessages = [
          ...prevMessages.map((m) => ({
            content: m.content,
            role: m.role as "user" | "assistant",
          })),
          { content, role: "user" as const },
        ];

        const result = streamText({
          abortSignal: abortController.signal,
          messages: allMessages,
          model,
          onError: ({ error: streamError }) => {
            console.error("[ai-chat] streamText onError:", streamError);
          },
          system,
        });

        for await (const chunk of result.textStream) {
          patch(connectionId, (prev) => {
            const messages = [...prev.messages];
            const last = messages.at(-1);
            if (last?.role === "assistant") {
              messages[messages.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return { messages };
          });
        }

        patch(connectionId, { abortController: null, isStreaming: false });

        const finalMessages = get().byConnection[connectionId]?.messages ?? [];
        saveChatHistory(connectionId, finalMessages);
      } catch (error) {
        console.error("[ai-chat] error:", error);

        if (error instanceof Error && error.name === "AbortError") {
          patch(connectionId, {
            abortController: null,
            isStreaming: false,
          });
          const finalMessages =
            get().byConnection[connectionId]?.messages ?? [];
          saveChatHistory(connectionId, finalMessages);
          return;
        }

        patch(connectionId, (prev) => ({
          abortController: null,
          error: classifyAIError(error),
          isStreaming: false,
          messages: prev.messages.slice(0, -2),
        }));

        const finalMessages = get().byConnection[connectionId]?.messages ?? [];
        saveChatHistory(connectionId, finalMessages);
      }
    },

    stopStreaming: (connectionId) => {
      get().byConnection[connectionId]?.abortController?.abort();
    },
  };
});

export const selectConnectionState =
  (connectionId: string): ((store: AiChatStore) => ChatConnectionState) =>
  (store) =>
    store.byConnection[connectionId] ?? EMPTY_STATE;
