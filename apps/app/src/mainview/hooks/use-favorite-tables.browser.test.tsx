import { act } from "react";
import { describe, expect, it } from "vitest";

import { useFavoriteTables } from "@/hooks/use-favorite-tables";
import { renderHook } from "@/test/render-hook";

describe("useFavoriteTables", () => {
  it("starts empty when no entries are stored", () => {
    const { result } = renderHook(() => useFavoriteTables("conn-1"));
    expect(result.current.favoriteTables).toStrictEqual([]);
    expect(result.current.isFavorite("users")).toBeFalsy();
  });

  it("toggles a table on and off and persists via storage", () => {
    const { result } = renderHook(() => useFavoriteTables("conn-1"));

    act(() => {
      result.current.toggleFavorite("users");
    });
    expect(result.current.favoriteTables).toStrictEqual(["users"]);
    expect(result.current.isFavorite("users")).toBeTruthy();
    expect(localStorage.getItem("oh-my-query-favorite-tables-conn-1")).toBe(
      JSON.stringify(["users"])
    );

    act(() => {
      result.current.toggleFavorite("users");
    });
    expect(result.current.favoriteTables).toStrictEqual([]);
  });

  it("loads existing favorites from storage on mount", () => {
    localStorage.setItem(
      "oh-my-query-favorite-tables-conn-2",
      JSON.stringify(["orders", "products"])
    );
    const { result } = renderHook(() => useFavoriteTables("conn-2"));
    expect(result.current.favoriteTables).toStrictEqual(["orders", "products"]);
  });

  it("migrates legacy pinned-tables entries to the new key", () => {
    localStorage.setItem(
      "oh-my-query-pinned-tables-legacy",
      JSON.stringify(["legacy"])
    );
    const { result } = renderHook(() => useFavoriteTables("legacy"));
    expect(result.current.favoriteTables).toStrictEqual(["legacy"]);
    expect(localStorage.getItem("oh-my-query-pinned-tables-legacy")).toBeNull();
    expect(localStorage.getItem("oh-my-query-favorite-tables-legacy")).toBe(
      JSON.stringify(["legacy"])
    );
  });

  it("reloads when connectionId changes", () => {
    localStorage.setItem(
      "oh-my-query-favorite-tables-a",
      JSON.stringify(["t1"])
    );
    localStorage.setItem(
      "oh-my-query-favorite-tables-b",
      JSON.stringify(["t2"])
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useFavoriteTables(id),
      { initialProps: { id: "a" } }
    );
    expect(result.current.favoriteTables).toStrictEqual(["t1"]);
    rerender({ id: "b" });
    expect(result.current.favoriteTables).toStrictEqual(["t2"]);
  });
});
