import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { ChatInput } from "./chat-input";

const renderInput = (
  overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}
) =>
  render(
    <ChatInput
      isConfigured={overrides.isConfigured ?? true}
      isStreaming={overrides.isStreaming ?? false}
      onOpenSettings={overrides.onOpenSettings ?? vi.fn()}
      onSend={overrides.onSend ?? vi.fn()}
      onStop={overrides.onStop ?? vi.fn()}
    />
  );

describe("chat-input", () => {
  it("shows the configure banner when not configured and triggers onOpenSettings", async () => {
    const onOpenSettings = vi.fn();
    const screen = renderInput({ isConfigured: false, onOpenSettings });

    expect(screen.getByText(/connect an ai provider/i)).toBeInTheDocument();

    await screen.getByRole("button", { name: /configure/i }).click();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("disables the textarea while not configured", () => {
    const screen = renderInput({ isConfigured: false });

    const textarea = screen.getByPlaceholder(/ask about your database/i);
    expect(textarea.element()).toBeDisabled();
  });

  it("hides the configure banner while configuration is loading (null)", () => {
    const screen = renderInput({ isConfigured: null });
    expect(screen.getByText(/connect an ai provider/i).query()).toBeNull();
  });

  it("calls onSend with trimmed text and clears the textarea on submit", async () => {
    const onSend = vi.fn();
    const screen = renderInput({ onSend });

    const textarea = screen.getByPlaceholder(/ask about your database/i);
    await textarea.fill("  list all users  ");
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledExactlyOnceWith("list all users");
    expect(textarea.element()).toHaveValue("");
  });

  it("does not send when the message is whitespace only", async () => {
    const onSend = vi.fn();
    const screen = renderInput({ onSend });

    await screen.getByPlaceholder(/ask about your database/i).fill("    ");
    await userEvent.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });
});
