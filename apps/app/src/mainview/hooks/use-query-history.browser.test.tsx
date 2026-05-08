import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "@/lib/persistence";

import { useQueryHistory } from "@/hooks/use-query-history";
import { HISTORY_UPDATED_EVENT } from "@/lib/persistence";
import { renderHook, waitFor } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

const sampleEntry: HistoryEntry = {
  connectionId: "conn-1",
  database: "public",
  dialect: null,
  error: null,
  executionTimeMs: 12,
  sql: "SELECT 1",
  success: true,
  timestamp: "2024-01-01T00:00:00.000Z",
};

describe("useQueryHistory", () => {
  it("loads history entries on mount", async () => {
    mockTauri({
      getHistory: () => [sampleEntry],
    });
    const { result } = renderHook(() => useQueryHistory("conn-1"));

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.entries).toStrictEqual([sampleEntry]);
    expect(result.current.error).toBeNull();
  });

  it("captures an error message when the RPC fails", async () => {
    mockTauri({
      getHistory: () => {
        throw new Error("kaboom");
      },
    });
    const { result } = renderHook(() => useQueryHistory("conn-1"));

    await waitFor(() => expect(result.current.error).toBe("kaboom"));
    expect(result.current.entries).toStrictEqual([]);
    expect(result.current.isLoading).toBeFalsy();
  });

  it("refetches when the HISTORY_UPDATED_EVENT fires", async () => {
    let calls = 0;
    mockTauri({
      getHistory: () => {
        calls += 1;
        return [];
      },
    });
    renderHook(() => useQueryHistory("conn-1"));
    await waitFor(() => expect(calls).toBe(1));

    window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
    await waitFor(() => expect(calls).toBe(2));
  });

  it("re-fetches when connectionId changes", async () => {
    const calls: string[] = [];
    mockTauri({
      getHistory: (payload) => {
        calls.push(payload.connectionId as string);
        return [];
      },
    });
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useQueryHistory(id),
      { initialProps: { id: "conn-a" } }
    );
    await waitFor(() => expect(calls).toContain("conn-a"));
    rerender({ id: "conn-b" });
    await waitFor(() => expect(calls).toContain("conn-b"));
  });
});
