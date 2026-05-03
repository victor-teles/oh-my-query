import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { AIError } from "@/lib/ai-errors";

import { ChatError } from "./chat-error";

const baseError: AIError = {
  message: "Cannot reach the AI provider.",
  retryable: true,
  suggestion: "Check your internet connection and try again.",
  type: "network",
};

describe("chat-error", () => {
  it("renders the message, suggestion, and retry button for retryable errors", async () => {
    const onRetry = vi.fn();
    const screen = render(
      <ChatError
        error={baseError}
        onDismiss={vi.fn()}
        onOpenSettings={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(baseError.message)).toBeInTheDocument();
    expect(screen.getByText(baseError.suggestion)).toBeInTheDocument();

    await screen.getByRole("button", { name: /^retry$/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.container).toMatchSnapshot();
  });

  it("hides retry when the error is not retryable", () => {
    const screen = render(
      <ChatError
        error={{ ...baseError, retryable: false, type: "context_length" }}
        onDismiss={vi.fn()}
        onOpenSettings={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /^retry$/i }).query()).toBeNull();
  });

  it("shows Open Settings for auth and model_not_found errors", async () => {
    const onOpenSettings = vi.fn();
    const screen = render(
      <ChatError
        error={{ ...baseError, retryable: false, type: "auth" }}
        onDismiss={vi.fn()}
        onOpenSettings={onOpenSettings}
        onRetry={vi.fn()}
      />
    );

    await screen.getByRole("button", { name: /open settings/i }).click();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("calls onDismiss from the close button", async () => {
    const onDismiss = vi.fn();
    const screen = render(
      <ChatError
        error={baseError}
        onDismiss={onDismiss}
        onOpenSettings={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    await screen.getByRole("button", { name: /dismiss error/i }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
