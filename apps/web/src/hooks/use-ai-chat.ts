import { streamText } from "ai";
import { useCallback, useRef, useState } from "react";

import type { SchemaInfo } from "@/lib/tauri";

import { createAIModel } from "@/lib/ai-provider";
import { buildSystemPrompt } from "@/lib/ai-schema-formatter";
import { getAISettings } from "@/lib/ai-settings";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
}

interface UseAiChatOptions {
  schema: SchemaInfo | null;
  databaseType: string;
}

export const useAiChat = ({ schema, databaseType }: UseAiChatOptions) => {
  const [state, setState] = useState<AiChatState>({
    error: null,
    isStreaming: false,
    messages: [],
  });
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const settings = await getAISettings();
      if (!settings) {
        setState((prev) => ({
          ...prev,
          error:
            "AI is not configured. Please set up your API key in settings.",
        }));
        return;
      }

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

      setState((prev) => ({
        ...prev,
        error: null,
        isStreaming: true,
        messages: [...prev.messages, userMessage, assistantMessage],
      }));

      try {
        const model = createAIModel(settings);
        const system = schema
          ? buildSystemPrompt(schema, databaseType)
          : `You are a SQL assistant for a ${databaseType} database. Help users write queries, explain SQL, diagnose errors, and suggest optimizations. Wrap SQL in \`\`\`sql code blocks.`;

        const allMessages = [
          ...state.messages.map((m) => ({
            content: m.content,
            role: m.role as "user" | "assistant",
          })),
          { content, role: "user" as const },
        ];

        abortRef.current = new AbortController();

        const result = streamText({
          abortSignal: abortRef.current.signal,
          messages: allMessages,
          model,
          system,
        });

        for await (const chunk of result.textStream) {
          setState((prev) => {
            const messages = [...prev.messages];
            const last = messages.at(-1);
            if (last?.role === "assistant") {
              messages[messages.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return { ...prev, messages };
          });
        }

        setState((prev) => ({ ...prev, isStreaming: false }));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        setState((prev) => ({
          ...prev,
          error: message,
          isStreaming: false,
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [schema, databaseType, state.messages]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setState({ error: null, isStreaming: false, messages: [] });
  }, []);

  return {
    clearMessages,
    error: state.error,
    isStreaming: state.isStreaming,
    messages: state.messages,
    sendMessage,
    stopStreaming,
  };
};
