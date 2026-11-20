import { describe, expect, it } from "vitest";

import { renderHook } from "@/test/render-hook";

import { useListSelection } from "./use-list-selection";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("useListSelection", () => {
  it("selects the first item by default", () => {
    const { result } = renderHook(() => useListSelection(items));
    expect(result.current.selected?.id).toBe("a");
  });

  it("moves and wraps in both directions", async () => {
    const { result } = renderHook(() => useListSelection(items));
    result.current.move(-1);
    await expect.poll(() => result.current.selected?.id).toBe("c");
    result.current.move(1);
    await expect.poll(() => result.current.selected?.id).toBe("a");
  });

  it("falls back to the first item when the selection is filtered out", async () => {
    const { result, rerender } = renderHook(
      (list: { id: string }[]) => useListSelection(list),
      { initialProps: items }
    );
    result.current.select("c");
    await expect.poll(() => result.current.selected?.id).toBe("c");

    rerender([{ id: "a" }, { id: "b" }]);
    await expect.poll(() => result.current.selected?.id).toBe("a");
  });

  it("starts on a requested item", () => {
    const { result } = renderHook(() => useListSelection(items, "b"));
    expect(result.current.selected?.id).toBe("b");
  });

  it("has no selection for an empty list and ignores moves", () => {
    const { result } = renderHook(() => useListSelection([]));
    result.current.move(1);
    expect(result.current.selected).toBeNull();
  });
});
