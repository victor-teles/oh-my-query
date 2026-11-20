import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { renderHook } from "@/test/render-hook";

import { useLauncherHotkeys } from "./use-launcher-hotkeys";

const setup = (depth: number, query: string, hotkey: string | null = null) => {
  const handlers = {
    onClearQuery: vi.fn(),
    onDismiss: vi.fn(),
    onOpenSettings: vi.fn(),
    onPop: vi.fn(),
  };
  renderHook(() => useLauncherHotkeys({ depth, hotkey, query, ...handlers }));
  return handlers;
};

describe("useLauncherHotkeys", () => {
  it("pops a pushed view before anything else", async () => {
    const handlers = setup(2, "typed");
    await userEvent.keyboard("{Escape}");
    expect(handlers.onPop).toHaveBeenCalledOnce();
    expect(handlers.onClearQuery).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it("clears a non-empty query at root", async () => {
    const handlers = setup(1, "typed");
    await userEvent.keyboard("{Escape}");
    expect(handlers.onClearQuery).toHaveBeenCalledOnce();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses at an empty root", async () => {
    const handlers = setup(1, "");
    await userEvent.keyboard("{Escape}");
    expect(handlers.onDismiss).toHaveBeenCalledOnce();
  });

  it("ignores Escape that a menu or select already handled", () => {
    const handlers = setup(2, "");
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "Escape",
    });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(handlers.onPop).not.toHaveBeenCalled();
  });

  it("opens settings with Command-comma only", async () => {
    const handlers = setup(1, "");
    await userEvent.keyboard(",");
    expect(handlers.onOpenSettings).not.toHaveBeenCalled();
    await userEvent.keyboard("{Meta>},{/Meta}");
    expect(handlers.onOpenSettings).toHaveBeenCalledOnce();
  });

  it("dismisses on its own hotkey while focused", async () => {
    const handlers = setup(2, "typed", "Option+Shift+Space");
    await userEvent.keyboard("{Alt>}{Shift>}{Space}{/Shift}{/Alt}");
    expect(handlers.onDismiss).toHaveBeenCalledOnce();
    expect(handlers.onPop).not.toHaveBeenCalled();
  });
});
