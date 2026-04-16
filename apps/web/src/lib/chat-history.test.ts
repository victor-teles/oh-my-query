import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/hooks/use-ai-chat";

import {
  clearChatHistory,
  getChatHistory,
  saveChatHistory,
} from "@/lib/chat-history";

const uniqueConnectionId = (suffix: string): string =>
  `ch-test-${suffix}-${crypto.randomUUID()}`;

const storageKey = (id: string): string => `oh-my-query-chat-history-${id}`;

const makeMessage = (
  role: "user" | "assistant",
  content: string
): ChatMessage => ({
  content,
  id: crypto.randomUUID(),
  role,
});

const roleAt = (index: number): "user" | "assistant" =>
  index % 2 === 0 ? "user" : "assistant";

describe("chat history persistence", () => {
  it("returns an empty array when nothing is stored", () => {
    const id = uniqueConnectionId("empty");
    expect(getChatHistory(id)).toStrictEqual([]);
  });

  it("round-trips messages", () => {
    const id = uniqueConnectionId("roundtrip");
    const messages: ChatMessage[] = [
      makeMessage("user", "hello"),
      makeMessage("assistant", "hi back"),
    ];
    saveChatHistory(id, messages);
    expect(getChatHistory(id)).toStrictEqual(messages);
  });

  it("trims to the last 50 messages on save", () => {
    const id = uniqueConnectionId("trim");
    const messages: ChatMessage[] = Array.from({ length: 60 }, (_, i) =>
      makeMessage(roleAt(i), `msg ${i}`)
    );
    saveChatHistory(id, messages);
    const restored = getChatHistory(id);
    expect(restored).toHaveLength(50);
    expect(restored[0]?.content).toBe("msg 10");
    expect(restored[49]?.content).toBe("msg 59");
  });

  it("filters out malformed entries on read", () => {
    const id = uniqueConnectionId("malformed");
    localStorage.setItem(
      storageKey(id),
      JSON.stringify([
        { content: "ok", id: "1", role: "user" },
        { content: 123, id: "2", role: "user" },
        { content: "missing role", id: "3" },
        { content: "bad role", id: "4", role: "system" },
      ])
    );
    const restored = getChatHistory(id);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.id).toBe("1");
  });

  it("returns empty when stored value is malformed JSON", () => {
    const id = uniqueConnectionId("bad-json");
    localStorage.setItem(storageKey(id), "{not-json");
    expect(getChatHistory(id)).toStrictEqual([]);
  });

  it("clearChatHistory removes the entry", () => {
    const id = uniqueConnectionId("clear");
    saveChatHistory(id, [makeMessage("user", "hi")]);
    clearChatHistory(id);
    expect(localStorage.getItem(storageKey(id))).toBeNull();
    expect(getChatHistory(id)).toStrictEqual([]);
  });
});
