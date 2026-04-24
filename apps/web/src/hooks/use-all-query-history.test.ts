import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "@/lib/persistence";

import { mockTauri } from "@/test/tauri-mock";

const { useAllQueryHistory } = await import("@/hooks/use-all-query-history");
const { HISTORY_UPDATED_EVENT } = await import("@/lib/persistence");

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  connectionId: "conn-a",
  database: null,
  dialect: "postgresql",
  error: null,
  executionTimeMs: 10,
  sql: "SELECT 1",
  success: true,
  timestamp: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("useAllQueryHistory", () => {
  it("calls get_all_history with the filters and returns entries", async () => {
    const entries = [makeEntry({ sql: "one" }), makeEntry({ sql: "two" })];
    const getAll = vi.fn(() => entries);
    mockTauri({ get_all_history: getAll });

    const filters = { erroredOnly: true };
    const { result } = renderHook(() => useAllQueryHistory(filters));

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.entries).toStrictEqual(entries);
    expect(getAll).toHaveBeenCalledWith({ filters });
  });

  it("refreshes when HISTORY_UPDATED_EVENT fires", async () => {
    const getAll = vi.fn(() => []);
    mockTauri({ get_all_history: getAll });

    const { result } = renderHook(() => useAllQueryHistory({}));
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(getAll).toHaveBeenCalledOnce();

    act(() => {
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
    });

    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(2));
  });

  it("reports errors thrown by the backend", async () => {
    mockTauri({
      get_all_history: () => {
        throw new Error("boom");
      },
    });

    const { result } = renderHook(() => useAllQueryHistory({}));

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.error).toBe("boom");
    expect(result.current.entries).toStrictEqual([]);
  });
});
