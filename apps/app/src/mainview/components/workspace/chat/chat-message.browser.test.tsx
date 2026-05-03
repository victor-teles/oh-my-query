import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import { ChatMessage } from "./chat-message";

vi.mock(import("./highlighted-sql"), () => ({
  HighlightedSql: ({ code }: { code: string }) => (
    <pre data-testid="hl-sql">{code}</pre>
  ),
}));

const message = (overrides: Partial<ChatMessageType>): ChatMessageType => ({
  content: "",
  id: "m1",
  role: "assistant",
  ...overrides,
});

describe("chat-message — user", () => {
  it("renders the raw content for user messages", () => {
    const screen = render(
      <ChatMessage
        message={message({ content: "List all users", role: "user" })}
      />
    );

    expect(screen.getByText("List all users")).toBeInTheDocument();
  });
});

describe("chat-message — assistant", () => {
  it("renders a loading indicator when content is empty", () => {
    const screen = render(<ChatMessage message={message({ content: "" })} />);

    expect(screen.getByLabelText("Generating response")).toBeInTheDocument();
  });

  it("renders plain prose text", async () => {
    const screen = render(
      <ChatMessage message={message({ content: "All good." })} />
    );

    await expect.element(screen.getByText("All good.")).toBeInTheDocument();
  });

  it("renders SQL fences via SqlCodeBlock with action buttons", async () => {
    const onInsertSql = vi.fn();
    const screen = render(
      <ChatMessage
        message={message({ content: "```sql\nSELECT 1\n```" })}
        onInsertSql={onInsertSql}
      />
    );

    await expect
      .element(screen.getByTestId("hl-sql"))
      .toHaveTextContent("SELECT 1");
    await screen.getByRole("button", { name: /insert to editor/i }).click();
    expect(onInsertSql).toHaveBeenCalledExactlyOnceWith("SELECT 1");
  });
});
