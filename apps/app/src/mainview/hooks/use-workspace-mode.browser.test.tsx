import { act } from "react";
import { describe, expect, it } from "vitest";

import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { renderHook } from "@/test/render-hook";

describe("useWorkspaceMode", () => {
  it("falls back to the default split mode when nothing is stored", () => {
    const { result } = renderHook(() => useWorkspaceMode("conn-1"));
    expect(result.current.mode).toBe("split");
  });

  it("loads a stored mode from localStorage", () => {
    localStorage.setItem("oh-my-query-workspace-mode-conn-2", "chat");
    const { result } = renderHook(() => useWorkspaceMode("conn-2"));
    expect(result.current.mode).toBe("chat");
  });

  it("ignores invalid values and uses the default", () => {
    localStorage.setItem("oh-my-query-workspace-mode-conn-3", "bogus");
    const { result } = renderHook(() => useWorkspaceMode("conn-3"));
    expect(result.current.mode).toBe("split");
  });

  it("setMode updates state and persists the new value", () => {
    const { result } = renderHook(() => useWorkspaceMode("conn-4"));

    act(() => {
      result.current.setMode("editor");
    });
    expect(result.current.mode).toBe("editor");
    expect(localStorage.getItem("oh-my-query-workspace-mode-conn-4")).toBe(
      "editor"
    );
  });

  it("re-reads when the connectionId changes", () => {
    localStorage.setItem("oh-my-query-workspace-mode-a", "editor");
    localStorage.setItem("oh-my-query-workspace-mode-b", "chat");
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useWorkspaceMode(id),
      { initialProps: { id: "a" } }
    );
    expect(result.current.mode).toBe("editor");
    rerender({ id: "b" });
    expect(result.current.mode).toBe("chat");
  });
});
