import { describe, expect, it } from "vitest";

import { getFavoriteTables, saveFavoriteTables } from "@/lib/favorite-tables";

const KEY_PREFIX = "oh-my-query-favorite-tables-";
const LEGACY_PREFIX = "oh-my-query-pinned-tables-";

describe("favorite-tables storage", () => {
  it("returns [] when nothing is stored", () => {
    expect(getFavoriteTables("conn-1")).toStrictEqual([]);
  });

  it("returns the stored list for a connection id", () => {
    localStorage.setItem(
      `${KEY_PREFIX}conn-1`,
      JSON.stringify(["users", "orders"])
    );
    expect(getFavoriteTables("conn-1")).toStrictEqual(["users", "orders"]);
  });

  it("ignores corrupt JSON and returns []", () => {
    localStorage.setItem(`${KEY_PREFIX}conn-1`, "{not json");
    expect(getFavoriteTables("conn-1")).toStrictEqual([]);
  });

  it("ignores non-array stored values", () => {
    localStorage.setItem(`${KEY_PREFIX}conn-1`, JSON.stringify({ a: 1 }));
    expect(getFavoriteTables("conn-1")).toStrictEqual([]);
  });

  it("migrates from legacy pinned-tables storage on read", () => {
    localStorage.setItem(
      `${LEGACY_PREFIX}conn-2`,
      JSON.stringify(["products"])
    );

    expect(getFavoriteTables("conn-2")).toStrictEqual(["products"]);
    expect(localStorage.getItem(`${LEGACY_PREFIX}conn-2`)).toBeNull();
    expect(localStorage.getItem(`${KEY_PREFIX}conn-2`)).toBe(
      JSON.stringify(["products"])
    );
  });

  it("does not migrate when both keys exist", () => {
    localStorage.setItem(`${KEY_PREFIX}conn-3`, JSON.stringify(["a"]));
    localStorage.setItem(`${LEGACY_PREFIX}conn-3`, JSON.stringify(["b"]));
    expect(getFavoriteTables("conn-3")).toStrictEqual(["a"]);
    expect(localStorage.getItem(`${LEGACY_PREFIX}conn-3`)).not.toBeNull();
  });

  it("saves under the namespaced key", () => {
    saveFavoriteTables("conn-4", ["x", "y"]);
    expect(localStorage.getItem(`${KEY_PREFIX}conn-4`)).toBe(
      JSON.stringify(["x", "y"])
    );
  });
});
