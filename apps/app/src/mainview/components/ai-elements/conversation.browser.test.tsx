import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ConversationMessage } from "./conversation";

import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  messagesToMarkdown,
} from "./conversation";

describe("conversation", () => {
  it("renders content area with role=log", () => {
    const screen = render(
      <Conversation>
        <ConversationContent>
          <p>Message 1</p>
        </ConversationContent>
      </Conversation>
    );

    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
  });
});

describe("conversationEmptyState", () => {
  it("renders default copy", () => {
    const screen = render(<ConversationEmptyState />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start a conversation to see messages here")
    ).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("renders custom title, description, icon, and children", () => {
    const screen = render(
      <ConversationEmptyState
        description="Ask me anything"
        icon={<span data-testid="icon">★</span>}
        title="Get started"
      >
        <button type="button">Try a prompt</button>
      </ConversationEmptyState>
    );

    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.getByText("Ask me anything")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try a prompt" })
    ).toBeInTheDocument();
  });
});

describe("messagesToMarkdown", () => {
  it("formats role + content with a default formatter", () => {
    const messages: ConversationMessage[] = [
      { content: "Hi", role: "user" },
      { content: "Hello", role: "assistant" },
    ];

    expect(messagesToMarkdown(messages)).toBe(
      "**User:** Hi\n\n**Assistant:** Hello"
    );
  });

  it("applies a custom formatter when provided", () => {
    const messages: ConversationMessage[] = [{ content: "x", role: "user" }];
    const formatter = vi.fn((m: ConversationMessage) => `> ${m.content}`);

    expect(messagesToMarkdown(messages, formatter)).toBe("> x");
    expect(formatter).toHaveBeenCalledOnce();
  });
});

describe("conversationDownload", () => {
  it("triggers a download when clicked", async () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");

    try {
      const messages: ConversationMessage[] = [
        { content: "hello", role: "user" },
      ];
      const screen = render(<ConversationDownload messages={messages} />);

      await screen.getByRole("button").click();

      expect(createSpy).toHaveBeenCalledOnce();
      const blob = createSpy.mock.calls[0]?.[0] as Blob;
      expect(blob.type).toBe("text/markdown");
      expect(revokeSpy).toHaveBeenCalledExactlyOnceWith("blob:fake");
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
