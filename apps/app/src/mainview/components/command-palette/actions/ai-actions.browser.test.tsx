import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";
import type { ChatMessage } from "@/stores/ai-chat-store";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";

import { AiActions } from "./ai-actions";

const noSelection = (): boolean => false;

const captured: { actions: CommandAction[] } = { actions: [] };

const Capture = () => {
  const { actions } = useCommandPalette();
  captured.actions = actions;
  return null;
};

interface RenderProps {
  messages?: ChatMessage[];
  isStreaming?: boolean;
  hasError?: boolean;
  hasSelection?: () => boolean;
  onInsert?: (sql: string) => void;
  onReplaceSelection?: (sql: string) => void;
  onClear?: () => void;
  onStop?: () => void;
  onRetry?: () => void;
}

const renderActions = (props: RenderProps = {}) => {
  captured.actions = [];
  return render(
    <CommandPaletteProvider>
      <AiActions
        hasError={props.hasError ?? false}
        hasSelection={props.hasSelection ?? noSelection}
        isStreaming={props.isStreaming ?? false}
        messages={props.messages ?? []}
        onClear={props.onClear ?? vi.fn()}
        onInsert={props.onInsert ?? vi.fn()}
        onReplaceSelection={props.onReplaceSelection ?? vi.fn()}
        onRetry={props.onRetry ?? vi.fn()}
        onStop={props.onStop ?? vi.fn()}
      />
      <Capture />
    </CommandPaletteProvider>
  );
};

const findAction = (id: string): CommandAction => {
  const action = captured.actions.find((a) => a.id === id);
  if (!action) {
    throw new Error(`Missing action: ${id}`);
  }
  return action;
};

describe("ai-actions — when()", () => {
  it("insert is hidden until an assistant message contains a SQL block", () => {
    renderActions({
      messages: [{ content: "no sql here", id: "1", role: "assistant" }],
    });
    expect(findAction("ai.insert-last-suggestion").when?.()).toBeFalsy();
  });

  it("insert is shown once an assistant message has a SQL fence", () => {
    renderActions({
      messages: [
        {
          content: "Try this:\n```sql\nSELECT 1\n```",
          id: "1",
          role: "assistant",
        },
      ],
    });
    expect(findAction("ai.insert-last-suggestion").when?.()).toBeTruthy();
  });

  it("replace requires both a SQL block and an active editor selection", () => {
    const messages: ChatMessage[] = [
      { content: "```sql\nSELECT 1\n```", id: "1", role: "assistant" },
    ];
    renderActions({ hasSelection: () => false, messages });
    expect(findAction("ai.replace-with-last-suggestion").when?.()).toBeFalsy();

    renderActions({ hasSelection: () => true, messages });
    expect(findAction("ai.replace-with-last-suggestion").when?.()).toBeTruthy();
  });

  it("stop, retry and clear when() return true under their respective gates", () => {
    renderActions({
      hasError: true,
      isStreaming: true,
      messages: [{ content: "hi", id: "1", role: "user" }],
    });

    expect([
      findAction("ai.stop-streaming").when?.(),
      findAction("ai.retry").when?.(),
      findAction("ai.clear").when?.(),
    ]).toStrictEqual([true, true, true]);
  });

  it("stop, retry and clear when() return false in their default state", () => {
    renderActions();

    expect([
      findAction("ai.stop-streaming").when?.(),
      findAction("ai.retry").when?.(),
      findAction("ai.clear").when?.(),
    ]).toStrictEqual([false, false, false]);
  });
});

describe("ai-actions — perform", () => {
  const sqlMessage: ChatMessage = {
    content:
      "Use this:\n```sql\nSELECT now();\n```\nand also:\n```\nSELECT 1;\n```",
    id: "1",
    role: "assistant",
  };

  it("insert calls onInsert with the most recent SQL block from assistant messages", async () => {
    const onInsert = vi.fn();
    renderActions({ messages: [sqlMessage], onInsert });

    await findAction("ai.insert-last-suggestion").perform();
    expect(onInsert).toHaveBeenCalledExactlyOnceWith("SELECT 1;");
  });

  it("replace calls onReplaceSelection with the most recent SQL block", async () => {
    const onReplaceSelection = vi.fn();
    renderActions({
      hasSelection: () => true,
      messages: [sqlMessage],
      onReplaceSelection,
    });

    await findAction("ai.replace-with-last-suggestion").perform();
    expect(onReplaceSelection).toHaveBeenCalledExactlyOnceWith("SELECT 1;");
  });

  it("stop calls onStop", async () => {
    const onStop = vi.fn();
    renderActions({ isStreaming: true, onStop });
    await findAction("ai.stop-streaming").perform();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("clear is destructive and confirm-required", () => {
    renderActions({ messages: [{ content: "hi", id: "1", role: "user" }] });
    const clear = findAction("ai.clear");
    expect(clear.destructive).toBeTruthy();
    expect(clear.confirm).toBeTruthy();
  });
});
