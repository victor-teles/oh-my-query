import { act } from "react";
import { describe, expect, it } from "vitest";

import { useAiChat } from "@/hooks/use-ai-chat";
import { useAiChatStore } from "@/stores/ai-chat-store";
import { renderHook } from "@/test/render-hook";

describe("useAiChat", () => {
  it("ensures the store has a slot for the connection on mount", () => {
    useAiChatStore.setState({ byConnection: {} });

    renderHook(() =>
      useAiChat({
        connectionId: "conn-9",
        databaseType: "postgresql",
        schema: null,
      })
    );

    expect(useAiChatStore.getState().byConnection["conn-9"]).toBeDefined();
  });

  it("exposes the current connection state from the store", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-1": {
          abortController: null,
          error: null,
          isStreaming: false,
          lastUserMessage: null,
          messages: [{ content: "hi", id: "m1", role: "user" }],
        },
      },
    });

    const { result } = renderHook(() =>
      useAiChat({
        connectionId: "conn-1",
        databaseType: "postgresql",
        schema: null,
      })
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.isStreaming).toBeFalsy();
    expect(result.current.error).toBeNull();
  });

  it("clearError resets the error in the store", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-2": {
          abortController: null,
          error: {
            message: "oops",
            retryable: false,
            suggestion: "—",
            type: "unknown",
          },
          isStreaming: false,
          lastUserMessage: null,
          messages: [],
        },
      },
    });

    const { result } = renderHook(() =>
      useAiChat({
        connectionId: "conn-2",
        databaseType: "postgresql",
        schema: null,
      })
    );

    act(() => {
      result.current.clearError();
    });
    expect(useAiChatStore.getState().byConnection["conn-2"]?.error).toBeNull();
  });

  it("clearMessages empties the connection's message list", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-3": {
          abortController: null,
          error: null,
          isStreaming: false,
          lastUserMessage: null,
          messages: [{ content: "hi", id: "x", role: "user" }],
        },
      },
    });

    const { result } = renderHook(() =>
      useAiChat({
        connectionId: "conn-3",
        databaseType: "postgresql",
        schema: null,
      })
    );

    act(() => {
      result.current.clearMessages();
    });
    expect(
      useAiChatStore.getState().byConnection["conn-3"]?.messages
    ).toStrictEqual([]);
  });
});
