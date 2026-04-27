import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockTauri } from "@/test/tauri-mock";

import { useConnections } from "./use-connections";

describe("useConnections", () => {
  it("loads connections on mount and exposes them sorted by recency", async () => {
    mockTauri({
      getConnections: () => [
        {
          createdAt: "2026-01-01T00:00:00Z",
          database: "db",
          host: "h",
          id: "old",
          lastConnectedAt: "2026-01-01T00:00:00Z",
          name: "Old",
          password: "",
          pinned: false,
          port: 5432,
          type: "postgresql",
          username: "u",
        },
        {
          createdAt: "2026-01-02T00:00:00Z",
          database: "db",
          host: "h",
          id: "new",
          lastConnectedAt: "2026-04-01T00:00:00Z",
          name: "New",
          password: "",
          pinned: false,
          port: 5432,
          type: "postgresql",
          username: "u",
        },
      ],
    });

    const { result } = renderHook(() => useConnections());
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.error).toBeNull();
    expect(result.current.flatList.map((c) => c.id)).toStrictEqual([
      "new",
      "old",
    ]);
  });

  it("flips isLoading to false even when getConnections rejects", async () => {
    mockTauri({
      getConnections: () => {
        throw new Error("DECRYPT_FAILED");
      },
    });

    const { result } = renderHook(() => useConnections());
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("DECRYPT_FAILED");
    expect(result.current.connections).toStrictEqual([]);
  });
});
