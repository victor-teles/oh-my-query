import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ChatMessage } from "@/hooks/use-ai-chat";

import { ChatMessageList } from "./chat-message-list";

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  content: "Hi",
  id: "m1",
  role: "assistant",
  ...overrides,
});

describe("chat-message-list", () => {
  it("renders the empty state with the connection name", () => {
    const screen = render(
      <ChatMessageList connectionName="my-db" messages={[]} />
    );

    expect(screen.getByText("Query assistant for my-db")).toBeInTheDocument();
    expect(
      screen.getByText(/generate sql, explain queries/i)
    ).toBeInTheDocument();
  });

  it("renders a message per item when populated", () => {
    const screen = render(
      <ChatMessageList
        connectionName="my-db"
        messages={[
          message({ content: "How many users?", id: "u1", role: "user" }),
          message({ content: "Counting now…", id: "a1", role: "assistant" }),
        ]}
        onInsertSql={vi.fn()}
      />
    );

    expect(screen.getByText("How many users?")).toBeInTheDocument();
    expect(screen.getByText("Counting now…")).toBeInTheDocument();
    expect(screen.getByText("Query assistant for my-db").query()).toBeNull();
  });
});
