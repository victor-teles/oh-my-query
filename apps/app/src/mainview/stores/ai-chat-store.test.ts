import { describe, expect, it } from "vitest";

import { selectConnectionState, useAiChatStore } from "@/stores/ai-chat-store";
import { mockTauri } from "@/test/tauri-mock";

describe("ensureConnection", () => {
  it("seeds an empty state for an unknown connection", () => {
    useAiChatStore.getState().ensureConnection("conn-1");
    expect(
      selectConnectionState("conn-1")(useAiChatStore.getState())
    ).toMatchObject({
      error: null,
      isStreaming: false,
      messages: [],
    });
  });

  it("restores prior chat history on first ensure", () => {
    localStorage.setItem(
      "oh-my-query-chat-history-conn-2",
      JSON.stringify([
        { content: "hi", id: "1", role: "user" },
        { content: "hello!", id: "2", role: "assistant" },
      ])
    );
    useAiChatStore.getState().ensureConnection("conn-2");
    expect(
      selectConnectionState("conn-2")(useAiChatStore.getState()).messages
    ).toHaveLength(2);
  });

  it("is idempotent — does not reset existing state", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-3": {
          abortController: null,
          error: null,
          isStreaming: false,
          lastUserMessage: "hi",
          messages: [{ content: "hi", id: "1", role: "user" }],
        },
      },
    });
    useAiChatStore.getState().ensureConnection("conn-3");
    expect(
      selectConnectionState("conn-3")(useAiChatStore.getState()).messages
    ).toHaveLength(1);
  });
});

describe("clearError + clearMessages", () => {
  it("clearError nulls out the error", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-4": {
          abortController: null,
          error: {
            message: "boom",
            retryable: false,
            suggestion: "retry",
            type: "unknown",
          },
          isStreaming: false,
          lastUserMessage: null,
          messages: [],
        },
      },
    });

    useAiChatStore.getState().clearError("conn-4");
    expect(
      selectConnectionState("conn-4")(useAiChatStore.getState()).error
    ).toBeNull();
  });

  it("clearMessages wipes messages and persisted history", () => {
    useAiChatStore.setState({
      byConnection: {
        "conn-5": {
          abortController: null,
          error: null,
          isStreaming: false,
          lastUserMessage: "hi",
          messages: [{ content: "hi", id: "1", role: "user" }],
        },
      },
    });
    localStorage.setItem(
      "oh-my-query-chat-history-conn-5",
      JSON.stringify([{ content: "hi", id: "1", role: "user" }])
    );

    useAiChatStore.getState().clearMessages("conn-5");

    expect(
      selectConnectionState("conn-5")(useAiChatStore.getState())
    ).toMatchObject({
      isStreaming: false,
      messages: [],
    });
    expect(localStorage.getItem("oh-my-query-chat-history-conn-5")).toBeNull();
  });
});

describe("sendMessage — not configured", () => {
  it("sets a not-configured error when AI settings are missing", async () => {
    mockTauri({
      getConfig: () => ({}),
    });

    await useAiChatStore.getState().sendMessage("conn-6", "hi", {
      databaseType: "postgresql",
      schema: null,
    });

    const state = selectConnectionState("conn-6")(useAiChatStore.getState());
    expect(state.error?.type).toBe("auth");
    expect(state.error?.message).toMatch(/not configured/i);
    expect(state.messages).toHaveLength(0);
  });
});

describe("retry", () => {
  it("is a no-op when there is no lastUserMessage", () => {
    useAiChatStore.getState().ensureConnection("conn-7");
    useAiChatStore.getState().retry("conn-7", {
      databaseType: "postgresql",
      schema: null,
    });
    expect(
      selectConnectionState("conn-7")(useAiChatStore.getState()).messages
    ).toHaveLength(0);
  });
});

describe("stopStreaming", () => {
  it("does nothing when there is no active controller", () => {
    useAiChatStore.getState().ensureConnection("conn-8");
    expect(() =>
      useAiChatStore.getState().stopStreaming("conn-8")
    ).not.toThrow();
  });

  it("aborts the active controller when present", () => {
    const controller = new AbortController();
    useAiChatStore.setState({
      byConnection: {
        "conn-9": {
          abortController: controller,
          error: null,
          isStreaming: true,
          lastUserMessage: null,
          messages: [],
        },
      },
    });

    useAiChatStore.getState().stopStreaming("conn-9");
    expect(controller.signal.aborted).toBeTruthy();
  });
});
